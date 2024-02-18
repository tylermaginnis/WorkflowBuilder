CREATE TYPE action_type_enum AS ENUM ('RABBITMQ_CONSUMER', 'STORED_PROCEDURE', 'EXTERNAL_SERVICE', 'RABBITMQ_PRODUCER');
-- Create ENUM type for status
CREATE TYPE txn_status_enum AS ENUM ('In Progress', 'Committed', 'Rolled Back');
-- Define custom enum type for status
CREATE TYPE action_status_enum AS ENUM ('SUCCESS', 'FAILURE');

-- Table to store workflow definitions
CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    revision INT DEFAULT 1, -- New column for revision number, defaulting to 1
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Table to store external services
CREATE TABLE IF NOT EXISTS workflow_external_services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

-- Table to store transactions and link them to workflows
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    workflow_id INT NOT NULL,
    status txn_status_enum NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

-- Table to store workflow actions
CREATE TABLE IF NOT EXISTS workflow_actions (
    id SERIAL PRIMARY KEY,
    workflow_id INT NOT NULL,
    ordinal INT NOT NULL,
    action_type action_type_enum NOT NULL,
    action_data JSONB,
    external_service_id INT,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id),
    FOREIGN KEY (external_service_id) REFERENCES workflow_external_services(id)
);


-- Table to log execution details of workflow actions
CREATE TABLE IF NOT EXISTS action_execution_log (
    id SERIAL PRIMARY KEY,
    action_id INT NOT NULL,
    execution_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status action_status_enum NULL,
    error_message TEXT,
    execution_result JSONB,
    FOREIGN KEY (action_id) REFERENCES workflow_actions(id)
);

-- Table to store parameters associated with workflow actions
CREATE TABLE IF NOT EXISTS workflow_action_parameters (
    id SERIAL PRIMARY KEY,
    action_id INT NOT NULL,
    parameter_name VARCHAR(255) NOT NULL,
    parameter_value JSONB,
    FOREIGN KEY (action_id) REFERENCES workflow_actions(id)
);


CREATE OR REPLACE FUNCTION get_workflows()
RETURNS TABLE (
    id INT,
    name VARCHAR(255),
    description TEXT,
    revision INT
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.name,
        w.description,
        w.revision
    FROM
        workflows w
    GROUP BY
        w.id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION create_workflow(
    p_name TEXT,
    p_description TEXT
)
RETURNS INT
AS $$
DECLARE
    v_workflow_id INT;
BEGIN
    -- Check if the name already exists in the workflows table
    IF EXISTS (SELECT 1 FROM workflows WHERE name = p_name) THEN
        RAISE EXCEPTION 'Workflow with name % already exists', p_name;
    END IF;
    
    -- Generate a new workflow_id using a sequence
    SELECT NEXTVAL('workflows_id_seq') INTO v_workflow_id;

    -- Insert the workflow into the workflows table
    INSERT INTO workflows (id, name, description, revision, created_at)
    VALUES (v_workflow_id, p_name, p_description, 1, NOW());

    -- Return the generated workflow_id
    RETURN v_workflow_id;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL; -- Return NULL if an exception occurs
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_workflow(
    p_workflow_id INT,
    p_updated_name VARCHAR(255),
    p_updated_description TEXT
)
RETURNS VOID
AS $$
BEGIN
    -- Check if the workflow with the provided ID exists
    IF NOT EXISTS (SELECT 1 FROM workflows WHERE id = p_workflow_id) THEN
        RAISE EXCEPTION 'Workflow with ID % not found', p_workflow_id;
    END IF;

    -- Update the workflow with the provided ID
    UPDATE workflows
    SET
        name = p_updated_name,
        description = p_updated_description
    WHERE
        id = p_workflow_id;

    -- Notify success
    RAISE NOTICE 'Workflow updated successfully.';
END;
$$ LANGUAGE plpgsql;




CREATE OR REPLACE FUNCTION get_workflow(IN workflow_id INT)
RETURNS TABLE (
    id INT,
    name VARCHAR(255),
    description TEXT,
    revision INT
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        w.id,
        w.name,
        w.description,
        w.revision
    FROM
        workflows w
    WHERE
        w.id = workflow_id
    GROUP BY
        w.id;
        
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workflow with ID % not found', workflow_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_workflow(IN workflow_id INT)
RETURNS BOOLEAN AS $$
DECLARE
    deleted BOOLEAN;
BEGIN
    deleted := FALSE; -- Initialize the deleted flag
    -- Check if the workflow exists
    IF EXISTS (SELECT 1 FROM workflows WHERE id = workflow_id) THEN
        -- If the workflow exists, delete it
        DELETE FROM workflows WHERE id = workflow_id;
        deleted := TRUE; -- Update the deleted flag
    END IF;
    -- Return the status indicating whether the workflow was deleted
    RETURN deleted;
END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION add_external_service(
    p_workflow_id INT,
    p_external_service_name VARCHAR(255),
    p_external_service_endpoint VARCHAR(255)
)
RETURNS VOID
AS $$
BEGIN
    -- Check if the workflow exists
    IF NOT EXISTS (SELECT 1 FROM workflows WHERE id = p_workflow_id) THEN
        RAISE EXCEPTION 'Workflow not found';
    END IF;

    -- Insert the external service into the database
    INSERT INTO workflow_external_services (workflow_id, name, endpoint)
    VALUES (p_workflow_id, p_external_service_name, p_external_service_endpoint);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_external_service(p_workflow_id INT, p_external_service_id INT)
RETURNS VOID
AS $$
BEGIN
    -- Check if the workflow exists
    IF NOT EXISTS (SELECT 1 FROM workflows WHERE id = p_workflow_id) THEN
        RAISE EXCEPTION 'Workflow not found';
    END IF;

    -- Delete the external service
    DELETE FROM workflow_external_services
    WHERE workflow_id = p_workflow_id AND id = p_external_service_id;

    -- Handle other cleanup logic if needed

END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION list_external_services(p_workflow_id INT)
RETURNS TABLE (
    external_service_id INT,
    external_service_name VARCHAR(255),
    external_service_endpoint VARCHAR(255)
)
AS $$
BEGIN
    RETURN QUERY
    SELECT
        we.id AS external_service_id,
        we.name AS external_service_name,
        we.endpoint AS external_service_endpoint
    FROM
        workflows w
    JOIN
        workflow_external_services we ON we.workflow_id = w.id
    WHERE
        w.id = p_workflow_id;
        
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No external services found for the workflow';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_workflow_action(
    p_workflow_id INT,
    p_ordinal INT,
    p_action_type action_type_enum,
    p_action_data JSONB,
    p_external_service_id INT DEFAULT NULL
)
RETURNS VOID
AS $$
BEGIN
    -- Check if the workflow exists
    IF NOT EXISTS (SELECT 1 FROM workflows WHERE id = p_workflow_id) THEN
        RAISE EXCEPTION 'Workflow not found';
    END IF;

    -- Check if the provided external service exists if the action type is EXTERNAL_SERVICE
    IF p_action_type = 'EXTERNAL_SERVICE' THEN
        IF NOT EXISTS (SELECT 1 FROM workflow_external_services WHERE id = p_external_service_id) THEN
            RAISE EXCEPTION 'External service not found';
        END IF;
    END IF;

    -- Insert the new action into the workflow_actions table
    INSERT INTO workflow_actions (workflow_id, ordinal, action_type, action_data, external_service_id)
    VALUES (p_workflow_id, p_ordinal, p_action_type, p_action_data, p_external_service_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_workflow_action(
    p_workflow_id INT,
    p_action_id INT
)
RETURNS VOID
AS $$
BEGIN
    -- Check if the workflow exists
    IF NOT EXISTS (SELECT 1 FROM workflows WHERE id = p_workflow_id) THEN
        RAISE EXCEPTION 'Workflow not found';
    END IF;

    -- Check if the action exists within the provided workflow
    IF NOT EXISTS (SELECT 1 FROM workflow_actions WHERE id = p_action_id AND workflow_id = p_workflow_id) THEN
        RAISE EXCEPTION 'Action not found in the specified workflow';
    END IF;

    -- Delete the specified action from the workflow_actions table
    DELETE FROM workflow_actions
    WHERE id = p_action_id AND workflow_id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION get_workflow_actions(
    p_workflow_id INT
)
RETURNS TABLE (
    action_id INT,
    ordinal INT,
    action_type action_type_enum,
    action_data JSONB,
    external_service_id INT
)
AS $$
BEGIN
    -- Check if the workflow exists
    IF NOT EXISTS (SELECT 1 FROM workflows WHERE id = p_workflow_id) THEN
        RAISE EXCEPTION 'Workflow not found';
    END IF;

    -- Retrieve all actions for the specified workflow
    RETURN QUERY
    SELECT
        id AS action_id,
        wa.ordinal,
        wa.action_type,
        wa.action_data,
        wa.external_service_id
    FROM
        workflow_actions wa
    WHERE
        workflow_id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE PROCEDURE insert_transaction(
    p_workflow_id INT,
    p_status txn_status_enum,
    p_details JSONB
)
LANGUAGE plpgsql
AS
$$
BEGIN
    INSERT INTO transactions (workflow_id, status, details)
    VALUES (p_workflow_id, p_status, p_details);
END;
$$;
