const express = require('express');
const bodyParser = require('body-parser');
const WorkflowBuilder = require('./WorkflowBuilder');
const { Pool } = require('pg');
const { Etcd3 } = require('etcd3');

const app = express();
const port = 3000;

const workflowBuilder = new WorkflowBuilder();

const pool = new Pool({
    user: 'admin',
    host: '172.17.0.3',
    database: 'Calo',
    password: 'password',
    port: 5432
});

// Etcd configuration
const etcd = new Etcd3({ hosts: '172.17.0.2:2379' });

app.use(bodyParser.json());

// index
app.get('/', (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            routes.push({
                path: middleware.route.path,
                methods: Object.keys(middleware.route.methods),
            });
        }
    });
    res.json(routes);
});

// Test route for database connection
app.get('/test-db-connection', async (req, res) => {
    try {
        // Attempt to connect to the database
        const client = await pool.connect();
        client.release(); // Release the client back to the pool
        res.json({ message: 'Database connection successful' });
    } catch (error) {
        console.error('Error connecting to database:', error);
        res.status(500).json({ error: 'Failed to connect to database' });
    }
});

// Test route for etcd connection
app.get('/test-etcd-connection', async (req, res) => {
    try {
        // Check the connection to etcd by performing a simple operation with a timeout
        await etcd.get('test-key').string('value', { timeout: 5000 }); // 5-second timeout
        res.json({ message: 'Etcd connection successful' });
    } catch (error) {
        console.error('Error connecting to etcd:', error);
        res.status(500).json({ error: 'Failed to connect to etcd', details: error.message });
    }
});



// Create a new workflow
app.post('/workflows', async (req, res) => {
    try {
        if (!req.body.name || !req.body.description) {
            return res.status(400).json({ error: 'Name and description are required fields' });
        }

        const workflowDefinition = req.body;
        const workflowInfo = await workflowBuilder.createWorkflow(workflowDefinition); // Call the function directly

        if (!workflowInfo) {
            return res.status(500).json({ error: 'Failed to create workflow. Unable to retrieve workflow information.' });
        }

        res.status(201).json(workflowInfo);
    } catch (error) {
        console.error('Error creating workflow:', error);
        res.status(500).json({ error: 'Failed to create workflow. Internal server error.' });
    }
});

// Get all workflows
app.get('/workflows', async (req, res) => {
    try {
        const workflows = await workflowBuilder.getWorkflows(); // Await the result

        if (!workflows || workflows.length === 0) {
            return res.status(404).json({ error: 'Workflows not found' });
        }

        res.status(200).json({ workflows: workflows });
    } catch (error) {
        console.error('Error retrieving workflows:', error);
        res.status(500).json({ error: 'Failed to retrieve workflows' });
    }
});

// Update an existing workflow
app.put('/workflows/:workflowId', async (req, res) => {
    const { workflowId } = req.params;
    try {
        if (!req.body.name || !req.body.description) {
            return res.status(400).json({ error: 'Name and description are required fields' });
        }

        const updatedWorkflow = await workflowBuilder.updateWorkflow(parseInt(workflowId), req.body);

        if (!updatedWorkflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        res.status(200).json({ workflow: updatedWorkflow });
    } catch (error) {
        console.error('Error updating workflow:', error);
        res.status(400).json({ error: 'Failed to update workflow' });
    }
});


// Get details of a specific workflow
app.get('/workflows/:workflowId', async (req, res) => {
    const { workflowId } = req.params;
    try {
        const workflow = await workflowBuilder.getWorkflow(parseInt(workflowId));

        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }

        res.status(200).json({ workflow });
    } catch (error) {
        console.error('Error retrieving workflow:', error);
        res.status(500).json({ error: 'Failed to retrieve workflow' });
    }
});

// Delete a workflow
app.delete('/workflows/:workflowId', async (req, res) => {
    const { workflowId } = req.params;
    try {
        workflowInfo = await workflowBuilder.deleteWorkflow(workflowId);
        res.status(200).json({ workflowInfo });
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// Execute a workflow
app.post('/workflows/:workflowId/execute', (req, res) => {
    const { workflowId } = req.params;
    try {
        const executionResult = workflowBuilder.executeWorkflow(workflowId, req.body);
        res.status(200).json({ result: executionResult });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Validate a workflow definition
app.post('/workflows/validate', (req, res) => {
    try {
        const validationResults = workflowBuilder.validateWorkflow(req.body);
        res.status(200).json({ validationResults });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Validate a workflow definition
app.post('/workflows/validate', async (req, res) => {
    try {
        const validationResults = await workflowBuilder.validateWorkflow(req.body);

        if (validationResults.valid) {
            res.status(200).json({ message: 'Workflow definition is valid' });
        } else {
            res.status(400).json({ error: 'Workflow definition is not valid', issues: validationResults.issues });
        }
    } catch (error) {
        console.error('Error validating workflow:', error);
        res.status(500).json({ error: 'Failed to validate workflow' });
    }
});

// Add external service to a workflow
app.post('/workflows/:workflowId/external-services', async (req, res) => {
    const { workflowId } = req.params;
    try {
        const { externalServiceDetails } = req.body;
        await workflowBuilder.addExternalService(parseInt(workflowId), externalServiceDetails);
        res.status(200).json({ message: 'External service added to the workflow successfully' });
    } catch (error) {
        console.error('Error adding external service:', error);
        if (error.message === 'Workflow not found') {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        res.status(400).json({ error: 'Failed to add external service to the workflow' });
    }
});
// Remove external service from a workflow
app.delete('/workflows/:workflowId/external-services/:externalServiceId', async (req, res) => {
    const { workflowId, externalServiceId } = req.params;
    try {
        await workflowBuilder.removeExternalService(parseInt(workflowId), parseInt(externalServiceId));
        res.status(200).json({ message: 'External service removed from the workflow successfully' });
    } catch (error) {
        console.error('Error removing external service:', error);
        if (error.message === 'Workflow not found') {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        res.status(400).json({ error: 'Failed to remove external service' });
    }
});

// List external services associated with a workflow
app.get('/workflows/:workflowId/external-services', async (req, res) => {
    const { workflowId } = req.params;
    try {
        const externalServices = await workflowBuilder.listExternalServices(parseInt(workflowId));

        if (externalServices.length === 0) {
            return res.status(404).json({ error: 'No external services found for the workflow' });
        }

        res.status(200).json({ externalServices });
    } catch (error) {
        console.error('Error listing external services:', error);
        res.status(500).json({ error: 'Failed to list external services' });
    }
});

// Add action to a workflow
app.post('/workflows/:workflowId/action', async (req, res) => {
    const { workflowId } = req.params;
    const actionDetails = req.body;
    try {
        await workflowBuilder.addWorkflowAction(parseInt(workflowId), actionDetails);
        res.status(200).json({ message: 'Action added to the workflow successfully' });
    } catch (error) {
        console.error('Error adding action to workflow:', error);
        if (error.message.includes('Workflow not found')) {
            return res.status(404).json({ error: 'Workflow not found' });
        } else if (error.message.includes('Invalid action type')) {
            return res.status(400).json({ error: 'Invalid action type provided' });
        } else if (error.message.includes('External service not found')) {
            return res.status(404).json({ error: 'External service not found' });
        } else {
            res.status(400).json({ error: 'Failed to add action to the workflow' });
        }
    }
});

// Delete action from a workflow
app.delete('/workflows/:workflowId/action/:actionId', async (req, res) => {
    const { workflowId, actionId } = req.params;
    try {
        await workflowBuilder.deleteWorkflowAction(parseInt(workflowId), parseInt(actionId));
        res.status(200).json({ message: 'Action deleted from the workflow successfully' });
    } catch (error) {
        console.error('Error deleting action from workflow:', error);
        if (error.message.includes('Workflow not found')) {
            return res.status(404).json({ error: 'Workflow not found' });
        } else if (error.message.includes('Action not found')) {
            return res.status(404).json({ error: 'Action not found in the specified workflow' });
        }
        res.status(400).json({ error: 'Failed to delete action from the workflow' });
    }
});

// Get all workflow actions for a workflow
app.get('/workflows/:workflowId/actions', async (req, res) => {
    const { workflowId } = req.params;
    try {
        const workflowActions = await workflowBuilder.getWorkflowActions(parseInt(workflowId));

        if (workflowActions.length === 0) {
            return res.status(404).json({ error: 'No workflow actions found for the specified workflow' });
        }

        res.status(200).json({ workflowActions });
    } catch (error) {
        console.error('Error getting workflow actions:', error);
        res.status(500).json({ error: 'Failed to retrieve workflow actions' });
    }
});

app.listen(port, () => {
    console.log(`WorkflowBuilder API listening at http://localhost:${port}`);
});
