# WorkflowBuilder API

This is a RESTful API built with Node.js using Express framework to manage workflows and their associated actions, leveraging PostgreSQL for data storage and etcd for service, workflow, and transaction discovery. This API provides endpoints to create, retrieve, update, and delete workflows, execute workflows, manage external services, and perform actions related to workflows.

## Prerequisites

Before running this API, ensure you have the following installed:

- Node.js
- PostgreSQL
- etcd

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/your/repository.git
   ```

2. Install dependencies:

   ```bash
   cd your-repository
   npm install
   ```

3. Set up PostgreSQL and etcd with appropriate configurations.

4. Start the server:

   ```bash
   npm start
   ```

## Endpoints

### 1. GET /workflows

- Description: Get all workflows.
- Response: List of workflows.

### 2. GET /workflows/:workflowId

- Description: Get details of a specific workflow.
- Response: Details of the specified workflow.

### 3. POST /workflows

- Description: Create a new workflow.
- Request Body: JSON object with `name` and `description` fields.
- Response: Details of the created workflow.

### 4. PUT /workflows/:workflowId

- Description: Update an existing workflow.
- Request Body: JSON object with `name` and `description` fields.
- Response: Details of the updated workflow.

### 5. DELETE /workflows/:workflowId

- Description: Delete a workflow.
- Response: Message indicating successful deletion.

### 6. POST /workflows/:workflowId/execute

- Description: Execute a workflow.
- Request Body: Data required for workflow execution.
- Response: Execution result.

### 7. POST /workflows/:workflowId/external-services

- Description: Add external service to a workflow.
- Request Body: Details of the external service.
- Response: Success message.

### 8. DELETE /workflows/:workflowId/external-services/:externalServiceId

- Description: Remove external service from a workflow.
- Response: Success message.

### 9. GET /workflows/:workflowId/external-services

- Description: List external services associated with a workflow.
- Response: List of external services.

### 10. POST /workflows/:workflowId/action

- Description: Add action to a workflow.
- Request Body: Details of the action.
- Response: Success message.

### 11. DELETE /workflows/:workflowId/action/:actionId

- Description: Delete action from a workflow.
- Response: Success message.

### 12. GET /workflows/:workflowId/actions

- Description: Get all workflow actions for a workflow.
- Response: List of workflow actions.

### 13. GET /test-db-connection

- Description: Test database connection.
- Response: Message indicating successful connection.

### 14. GET /test-etcd-connection

- Description: Test etcd connection.
- Response: Message indicating successful connection.

## Configuration

Ensure to configure the following environment variables for database and etcd connections:

- `DB_USER`: PostgreSQL username
- `DB_HOST`: PostgreSQL host address
- `DB_DATABASE`: PostgreSQL database name
- `DB_PASSWORD`: PostgreSQL password
- `DB_PORT`: PostgreSQL port
- `ETCD_HOSTS`: etcd host address

## License

This project is licensed under the MIT License.
