CREATE TABLE IF NOT EXISTS company (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_by_user_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(created_by_user_id) REFERENCES user (id)
);

CREATE TABLE IF NOT EXISTS project (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'idea',
    company_id INTEGER,
    created_by_user_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(company_id) REFERENCES company (id) ON DELETE SET NULL,
    FOREIGN KEY(created_by_user_id) REFERENCES user (id)
);

CREATE TABLE IF NOT EXISTS task (
    id INTEGER PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'backlog',
    due_date DATE,
    project_id INTEGER,
    created_by_user_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY(project_id) REFERENCES project (id) ON DELETE SET NULL,
    FOREIGN KEY(created_by_user_id) REFERENCES user (id)
);

CREATE TABLE IF NOT EXISTS page (
    id INTEGER PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS task_page_links (
    task_id INTEGER NOT NULL,
    page_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (task_id, page_id),
    FOREIGN KEY(task_id) REFERENCES task (id) ON DELETE CASCADE,
    FOREIGN KEY(page_id) REFERENCES page (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_view (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    database_key VARCHAR(20) NOT NULL,
    name VARCHAR(120) NOT NULL,
    query_json JSON NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    CONSTRAINT uq_saved_view_user_db_name UNIQUE (user_id, database_key, name),
    FOREIGN KEY(user_id) REFERENCES user (id)
);
