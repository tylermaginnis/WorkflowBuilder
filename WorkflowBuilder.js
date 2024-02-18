const { Pool } = require('pg');
const { Etcd3 } = require('etcd3');



class WorkflowBuilder {
    constructor() {
        this.pool = new Pool({
            user: 'admin',
            host: '172.17.0.3',
            database: 'Calo',
            password: 'password',
            port: 5432,
        });
        this.etcd = new Etcd3({ hosts: '172.17.0.2:2379' });
        this.workflows = {};
        this.initializeWorkflowInfo();
    }

    async initializeWorkflowInfo() {
        try {
            // Execute the stored procedure
            //const { rows } = await this.pool.query('SELECT * FROM get_workflow_info_for_execution()');
            // Process the result if needed
        } catch (error) {
            console.error('Error initializing workflow information:', error);
        }
    }

    async createWorkflow(workflowDefinition) {
        try {
            if (!workflowDefinition.name || !workflowDefinition.description) {
                return { error: 'Name and description are required fields' };
            }

            // Execute the stored procedure to create the workflow in the database
            const query = 'SELECT create_workflow($1, $2) AS workflow_id';
            const { rows } = await this.pool.query(query, [workflowDefinition.name, workflowDefinition.description]);

            if (!rows || !rows[0] || !rows[0].workflow_id) {
                return { error: 'Failed to create workflow. Workflow ID not returned from the database.' };
            }

            const workflowId = rows[0].workflow_id;

            // Construct a new object including the ID along with other properties
            const workflowInfo = {
                id: workflowId,
                name: workflowDefinition.name,
                description: workflowDefinition.description
            };

            return workflowInfo;
        } catch (error) {
            console.error('Error creating workflow:', error);
            return { error: 'Failed to create workflow. Internal server error.' };
        }
    }


    async updateWorkflow(workflowId, updatedDefinition) {
        try {
            // Update the workflow in the database
            const query = {
                text: 'SELECT update_workflow($1, $2, $3)',
                values: [
                    workflowId,
                    updatedDefinition.name,
                    updatedDefinition.description
                ],
            };
            const result = await this.pool.query(query);

            if (result.rowCount === 0) {
                return null;
            }

            console.log('Workflow updated successfully.');

            // Construct the updated workflow object (if needed)
            const updatedWorkflow = {
                workflow_id: workflowId,
                workflow_name: updatedDefinition.name,
                workflow_description: updatedDefinition.description,
                // Add other fields if needed
            };

            // Return the updated workflow information
            return updatedWorkflow;
        } catch (error) {
            console.error('Error updating workflow:', error);
            throw new Error('Failed to update workflow.');
        }
    }


    async getWorkflow(workflowId) {
        try {
            const { rows } = await this.pool.query('SELECT * FROM get_workflow($1)', [workflowId]);

            if (rows.length === 0) {
                return null;
            }

            return rows[0];
        } catch (error) {
            console.error('Error retrieving workflow:', error);
            throw new Error(`Error retrieving workflow: ${error.message}`);
        }
    }

    async getWorkflows() {
        try {
            const { rows } = await this.pool.query('SELECT * FROM get_workflows()');

            if (!rows || rows.length === 0) {
                throw new Error('Workflows not found');
            }

            return rows;
        } catch (error) {
            console.error('Error retrieving workflows:', error);
            throw new Error(`Error retrieving workflow: ${error.message}`);
        }
    }


    async deleteWorkflow(workflowId) {
        try {
            // Delete workflow from PostgreSQL database
            const { rows } = await this.pool.query('SELECT delete_workflow($1) AS deleted', [workflowId]);

            // Extract the deleted flag from the result
            const { deleted } = rows[0];

            if (deleted) {
                // If the workflow was successfully deleted, return success
                return { success: true };
            } else {
                // If the workflow was not found, return failure
                return { success: false, error: 'Workflow not found' };
            }
        } catch (error) {
            throw new Error(`Error deleting workflow: ${error.message}`);
        }
    }



    executeWorkflow(workflowId, inputData) {
        // Execute logic here
        // Placeholder for demonstration
        return `Workflow ${workflowId} executed with input data: ${JSON.stringify(inputData)}`;
    }

    validateWorkflow(workflowDefinition) {

        return { isValid: true, errors: [] };
    }

    async addExternalService(workflowId, externalServiceDetails) {
        try {
            // Call the stored procedure to add the external service
            await this.pool.query('SELECT add_external_service($1, $2, $3)', [
                workflowId,
                externalServiceDetails.name,
                externalServiceDetails.endpoint
            ]);
        } catch (error) {
            throw new Error(`Error adding external service: ${error.message}`);
        }
    }

    async removeExternalService(workflowId, externalServiceId) {
        try {
            // Call the SQL function to remove the external service
            await this.pool.query('SELECT remove_external_service($1, $2)', [workflowId, externalServiceId]);
            // If the function execution is successful, no errors will be thrown

            // Add any additional logic here if needed
        } catch (error) {
            console.error('Error removing external service:', error);
            throw new Error('Failed to remove external service');
        }
    }

    async listExternalServices(workflowId) {
        try {
            // Call the stored procedure to list external services for the given workflow ID
            const { rows } = await this.pool.query('SELECT * FROM list_external_services($1)', [workflowId]);
            return rows;
        } catch (error) {
            console.error('Error listing external services:', error);
            throw new Error('Failed to list external services');
        }
    }

    async addWorkflowAction(workflowId, actionDetails) {
        try {
            const { ordinal, actionType, actionData, externalServiceId } = actionDetails;

            const { rowCount } = await this.pool.query('SELECT add_workflow_action($1, $2, $3, $4, $5)', [workflowId, ordinal, actionType, actionData, externalServiceId]);

            if (rowCount === 0) {
                throw new Error('Failed to add action');
            }
        } catch (error) {
            throw new Error(`Error adding action to workflow: ${error.message}`);
        }
    }

    async deleteWorkflowAction(workflowId, actionId) {
        try {
            await this.pool.query('SELECT delete_workflow_action($1, $2)', [workflowId, actionId]);
        } catch (error) {
            throw new Error(`Error deleting action from workflow: ${error.message}`);
        }
    }

    async getWorkflowActions(workflowId) {
        try {
            const { rows } = await this.pool.query('SELECT * FROM get_workflow_actions($1)', [workflowId]);
            return rows;
        } catch (error) {
            console.error('Error getting actions for workflow:', error);
            throw new Error(`Error getting actions for workflow: ${error.message}`);
        }
    }



    generateWorkflowId() {
        return Math.random().toString(36).substr(2, 9);
    }
}

module.exports = WorkflowBuilder;
