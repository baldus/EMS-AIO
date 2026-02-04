import json
from datetime import datetime

from flask import abort, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required
from sqlalchemy import func

from app.decorators import roles_required
from app.extensions import db
from app.models import AuditLog, Block, Page, PAGE_BLOCK_TYPES
from app.pages import pages_bp


ALLOWED_CALLOUT_STYLES = ("note", "info", "warn")


def _log_page_action(action, entity_type, entity_id, metadata=None):
    db.session.add(
        AuditLog(
            actor_user_id=current_user.id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            metadata_json=metadata,
            ip_address=request.remote_addr,
        )
    )


def _normalize_title(title):
    cleaned = (title or "").strip()
    return cleaned if cleaned else "Untitled"


def _validate_block_payload(payload):
    if not isinstance(payload, list):
        abort(400)

    normalized = []
    for item in payload:
        if not isinstance(item, dict):
            abort(400)
        block_type = item.get("type")
        if block_type not in PAGE_BLOCK_TYPES:
            abort(400)
        block_id = item.get("id")
        content = item.get("content") or {}
        if block_type in ("text", "heading"):
            text = content.get("text", "")
            if not isinstance(text, str):
                abort(400)
            normalized_content = {"text": text}
        elif block_type == "bulleted_list":
            items = content.get("items", [])
            if not isinstance(items, list) or any(not isinstance(entry, str) for entry in items):
                abort(400)
            normalized_content = {"items": items}
        elif block_type == "checkbox_list":
            items = content.get("items", [])
            if not isinstance(items, list):
                abort(400)
            normalized_items = []
            for entry in items:
                if not isinstance(entry, dict):
                    abort(400)
                text = entry.get("text", "")
                checked = entry.get("checked", False)
                if not isinstance(text, str) or not isinstance(checked, bool):
                    abort(400)
                normalized_items.append({"text": text, "checked": checked})
            normalized_content = {"items": normalized_items}
        elif block_type == "divider":
            normalized_content = {}
        elif block_type == "callout":
            style = content.get("style", "note")
            text = content.get("text", "")
            if style not in ALLOWED_CALLOUT_STYLES or not isinstance(text, str):
                abort(400)
            normalized_content = {"style": style, "text": text}
        else:
            abort(400)

        normalized.append(
            {
                "id": block_id,
                "type": block_type,
                "content": normalized_content,
            }
        )

    return normalized


@pages_bp.route("")
@login_required
def pages_index():
    recent_pages = (
        Page.query.filter(Page.archived_at.is_(None))
        .order_by(func.coalesce(Page.last_edited_at, Page.created_at).desc())
        .all()
    )
    recent_activity = (
        AuditLog.query.filter(
            AuditLog.action.in_(
                [
                    "page_created",
                    "page_title_updated",
                    "page_archived",
                    "page_restored",
                    "page_viewed",
                    "block_added",
                    "block_updated",
                    "block_deleted",
                    "block_reordered",
                ]
            )
        )
        .order_by(AuditLog.created_at.desc())
        .limit(10)
        .all()
    )
    return render_template(
        "pages/index.html",
        pages=recent_pages,
        recent_activity=recent_activity,
    )


@pages_bp.route("/quick_capture", methods=["POST"])
@login_required
@roles_required("Admin", "Editor")
def quick_capture():
    capture_text = request.form.get("capture_text", "").strip()
    page = Page(
        title="Untitled",
        created_at=datetime.utcnow(),
        created_by_user_id=current_user.id,
    )
    db.session.add(page)
    db.session.flush()
    block = Block(
        page_id=page.id,
        type="text",
        position=1,
        content_json={"text": capture_text},
        created_by_user_id=current_user.id,
    )
    db.session.add(block)
    db.session.flush()
    _log_page_action("page_created", "Page", page.id, {"title": page.title})
    _log_page_action("block_added", "Block", block.id, {"page_id": page.id, "type": block.type})
    db.session.commit()
    return redirect(url_for("pages.page_edit", page_id=page.id))


@pages_bp.route("/new")
@login_required
@roles_required("Admin", "Editor")
def page_new():
    return render_template("pages/page_new.html")


@pages_bp.route("", methods=["POST"])
@login_required
@roles_required("Admin", "Editor")
def page_create():
    title = _normalize_title(request.form.get("title", ""))
    page = Page(
        title=title,
        created_at=datetime.utcnow(),
        created_by_user_id=current_user.id,
    )
    db.session.add(page)
    db.session.flush()
    _log_page_action("page_created", "Page", page.id, {"title": page.title})
    db.session.commit()
    return redirect(url_for("pages.page_edit", page_id=page.id))


@pages_bp.route("/<int:page_id>")
@login_required
def page_view(page_id):
    page = Page.query.get_or_404(page_id)
    if page.archived_at and current_user.role not in ("Admin", "Editor"):
        abort(404)
    page.last_viewed_at = datetime.utcnow()
    _log_page_action("page_viewed", "Page", page.id, {"title": page.title})
    db.session.commit()
    return render_template("pages/page_view.html", page=page)


@pages_bp.route("/<int:page_id>/edit")
@login_required
@roles_required("Admin", "Editor")
def page_edit(page_id):
    page = Page.query.get_or_404(page_id)
    if page.archived_at:
        flash("Archived pages must be restored before editing.", "error")
        return redirect(url_for("pages.page_view", page_id=page.id))
    return render_template("pages/page_edit.html", page=page)


@pages_bp.route("/<int:page_id>/save", methods=["POST"])
@login_required
@roles_required("Admin", "Editor")
def page_save(page_id):
    page = Page.query.get_or_404(page_id)
    if page.archived_at:
        abort(400)

    title = _normalize_title(request.form.get("title", ""))
    payload_raw = request.form.get("blocks_payload", "[]")
    try:
        payload = json.loads(payload_raw)
    except json.JSONDecodeError:
        abort(400)

    normalized_blocks = _validate_block_payload(payload)

    existing_blocks = Block.query.filter_by(page_id=page.id).order_by(Block.position.asc()).all()
    existing_by_id = {block.id: block for block in existing_blocks}
    existing_order = [block.id for block in existing_blocks]
    incoming_ids = []
    now = datetime.utcnow()
    title_changed = title != page.title

    with db.session.begin():
        page.title = title
        page.last_edited_at = now

        for position, block_data in enumerate(normalized_blocks, start=1):
            block_id = block_data.get("id")
            block_type = block_data["type"]
            content = block_data["content"]
            if block_id and block_id in existing_by_id:
                block = existing_by_id[block_id]
                incoming_ids.append(block.id)
                changes = {}
                if block.type != block_type:
                    block.type = block_type
                    changes["type"] = block_type
                if block.content_json != content:
                    block.content_json = content
                    changes["content"] = True
                if block.position != position:
                    block.position = position
                    changes["position"] = position
                if changes:
                    block.updated_by_user_id = current_user.id
                    _log_page_action(
                        "block_updated",
                        "Block",
                        block.id,
                        {"page_id": page.id, "changes": changes},
                    )
            else:
                block = Block(
                    page_id=page.id,
                    type=block_type,
                    position=position,
                    content_json=content,
                    created_by_user_id=current_user.id,
                )
                db.session.add(block)
                db.session.flush()
                incoming_ids.append(block.id)
                _log_page_action(
                    "block_added",
                    "Block",
                    block.id,
                    {"page_id": page.id, "type": block.type},
                )

        for block in existing_blocks:
            if block.id not in incoming_ids:
                _log_page_action(
                    "block_deleted",
                    "Block",
                    block.id,
                    {"page_id": page.id, "type": block.type},
                )
                db.session.delete(block)

        if title_changed:
            _log_page_action("page_title_updated", "Page", page.id, {"title": page.title})

        if existing_order != [block_id for block_id in incoming_ids if block_id in existing_by_id]:
            _log_page_action("block_reordered", "Page", page.id, {"page_id": page.id})

    flash("Page saved.", "success")
    return redirect(url_for("pages.page_view", page_id=page.id))


@pages_bp.route("/<int:page_id>/archive", methods=["POST"])
@login_required
@roles_required("Admin", "Editor")
def page_archive(page_id):
    page = Page.query.get_or_404(page_id)
    if page.archived_at:
        flash("Page already archived.", "info")
        return redirect(url_for("pages.page_view", page_id=page.id))
    page.archived_at = datetime.utcnow()
    page.archived_by_user_id = current_user.id
    _log_page_action("page_archived", "Page", page.id, {"title": page.title})
    db.session.commit()
    return redirect(url_for("pages.pages_index"))


@pages_bp.route("/<int:page_id>/restore", methods=["POST"])
@login_required
@roles_required("Admin", "Editor")
def page_restore(page_id):
    page = Page.query.get_or_404(page_id)
    page.archived_at = None
    page.archived_by_user_id = None
    _log_page_action("page_restored", "Page", page.id, {"title": page.title})
    db.session.commit()
    return redirect(url_for("pages.pages_index"))


@pages_bp.route("/archived")
@login_required
@roles_required("Admin", "Editor")
def archived_pages():
    pages = Page.query.filter(Page.archived_at.is_not(None)).order_by(Page.archived_at.desc()).all()
    return render_template("pages/archived.html", pages=pages)
