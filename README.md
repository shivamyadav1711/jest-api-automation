# Salon Booking API Automation

## Overview

This project contains a Jest and Supertest-based API automation suite for a salon booking backend built with Node.js, TypeScript, Express, and MongoDB.

The main objective is to verify that the application's authentication and booking APIs behave as expected. The tests cover the customer journey from registration and login to creating and cancelling an appointment, along with important error scenarios and authorization checks.

The tests run against a locally running backend connected to a dedicated MongoDB Atlas test database.

## Tech Stack

- **Node.js:** Runtime for the backend and test tools
- **TypeScript:** Backend application language
- **Express:** REST API framework
- **MongoDB Atlas:** Cloud database
- **Mongoose:** MongoDB object modelling
- **Jest:** Test runner and assertion library
- **Supertest:** HTTP client for API testing
- **bcryptjs:** Password hashing
- **jsonwebtoken:** Authentication token handling
- **dotenv:** Environment configuration

## Project Structure

```text
Jest-assignment-main/
├── controllers/
│   ├── authController.ts
│   ├── bookingController.ts
│   └── salonController.ts
├── middleware/
│   └── auth.ts
├── models/
│   ├── Booking.ts
│   ├── Salon.ts
│   ├── Service.ts
│   └── User.ts
├── routes/
│   ├── authRoutes.ts
│   ├── bookingRoutes.ts
│   └── salonRoutes.ts
├── utils/
│   └── seed.ts
├── tests/
│   ├── health.test.js
│   └── api-workflow.test.js
├── .env                 # Local configuration; do not commit
├── .gitignore
├── index.ts
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

The controllers contain the API logic, the routes define the available endpoints, and the models describe the database documents. The `tests` directory contains the automated checks.

## Prerequisites

Before running the application, make sure you have:

- Node.js 24.x. The project was tested with Node.js v24.15.0.
- npm, which is included with Node.js. The development environment used npm 11.12.1.
- Access to a MongoDB Atlas cluster or another reachable MongoDB deployment.
- A MongoDB database user with permission to read and write the test database.
- A terminal and an editor such as Visual Studio Code.

The Atlas cluster must allow connections from your current public IP address. Check the Atlas Network Access settings if the connection fails.

## Environment Setup

### 1. Install dependencies

Open a terminal in the project root, where `package.json` is located, and run:

```bash
npm install
```

### 2. Create the environment file

Create a file named `.env` in the project root, alongside `index.ts` and `package.json`.

Add the following settings, replacing the example values with your own:

```dotenv
PORT=3000
MONGO_URI=YOUR_MONGODB_URI_FOR_salon-test-db
JWT_SECRET=YOUR_PRIVATE_JWT_SECRET
API_BASE_URL=http://localhost:3000
```

Configure the values as follows:

- `PORT` is the port used by the Express server.
- `MONGO_URI` is the MongoDB connection string. The database path must point to `salon-test-db` for the automated workflow suite.
- `JWT_SECRET` is a private secret used to sign and verify authentication tokens.
- `API_BASE_URL` is the base URL used by the API workflow tests. If omitted, the tests use `http://localhost:3000`.

When using MongoDB Atlas, copy the connection details from your Atlas dashboard and retain the required connection options. Ensure the URI selects `salon-test-db` before its query parameters.

Do not commit your real `.env` file, database credentials, or JWT secret. The repository's `.gitignore` excludes `.env`.

### 3. Prepare the test database

The workflow tests use existing salon, service, and stylist records. The repository includes a seed script that creates this sample data.

Run the seed script from the project root:

```bash
npx tsx utils/seed.ts
```

**Important:** The seed script deletes existing documents from the `User`, `Salon`, `Service`, and `Booking` collections in the database selected by `MONGO_URI` before creating new sample records.

Use it only with a dedicated test database. Do not run it against a production database or a database containing records that must be preserved.

The seeded data includes an admin, two stylists, a salon, and two services. The workflow tests register their own customer accounts.

## Running the Application

Start the backend from the project root:

```bash
npm run dev
```

Wait for the following messages:

```text
Connected to MongoDB
Server running on port 3000
```

Keep this terminal open while running the tests. The test suite sends requests to the running API.

The health endpoint can be checked in a browser at:

```text
http://localhost:3000/
```

A successful response contains the status `ok` and a message indicating that the salon backend is running.

## Running the Tests

Open a second terminal in the same project directory and run:

```bash
npm test -- --runInBand
```

The `--runInBand` option runs the Jest tests sequentially in a single process, making execution easier to follow during local debugging.

To run the TypeScript build separately, use:

```bash
npm run build
```

To list the test files discovered by Jest, use:

```bash
npm test -- --listTests
```

The test command runs both files under `tests/`.

## Test Coverage

### Health check

`health.test.js` verifies that the health endpoint returns HTTP 200 and the expected JSON response.

### API workflow

`api-workflow.test.js` covers the main registration, authentication, availability, booking, and cancellation behavior.

The current checks include:

- Successful customer registration
- Rejection of duplicate email registration
- Successful login and token response
- Rejection of an incorrect password
- Available-slot response and missing query parameters
- Booking requests with missing or invalid authentication
- Booking requests with a missing date or a nonexistent service
- Successful booking creation
- Rejection of a conflicting appointment time
- Prevention of cancellation by another customer
- Handling of a nonexistent booking
- Successful cancellation by the booking owner
- Rejection of a second cancellation of the same booking

The assertions verify response status codes, important response fields, authentication behavior, ownership rules, and booking availability rules.

## Test Configuration and Data Management

The workflow suite uses Jest for test execution and Supertest to send HTTP requests to the running backend.

Before the tests run, the suite:

1. Checks that `MONGO_URI` points to `salon-test-db`.
2. Connects to the test database.
3. Looks up the seeded salon, service, and stylist records.
4. Creates unique email addresses for the test customers to reduce conflicts between runs.

The tests obtain database IDs from the seeded records rather than relying on fixed IDs.

After the tests finish, the suite removes the customer accounts created during the run and their associated bookings, then closes its Mongoose connection.

The tests depend on the backend being available at `API_BASE_URL` and on the required seed records existing in the test database. Run the seed script again if those records need to be recreated, remembering that it resets the relevant collections in the selected database.

## API Endpoints Covered

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Backend health check |
| POST | `/api/register` | Register a customer |
| POST | `/api/login` | Authenticate a customer |
| GET | `/api/salons/:salonId/available-slots` | Retrieve available appointment slots |
| POST | `/api/bookings` | Create a booking |
| POST | `/api/bookings/:bookingId/cancel` | Cancel a booking |

## Assumptions and Limitations

- The backend and test runner are started separately. The API tests expect the backend to already be listening at the configured base URL.
- The workflow suite requires the test database to contain the seeded salon, service, and stylist records.
- The tests use real HTTP requests and a real MongoDB database rather than mocking the API responses.
- The tests clean up their own customer records and associated bookings. They do not reset the entire database during test execution.
- The seed script is intentionally separate from the test run because it deletes existing records in the selected database before reseeding.
- The test database and JWT secret should remain local development configuration and must not be committed to source control.

## Current Verification

During development, the following checks completed successfully:

- The TypeScript build completed without compilation errors.
- The health-check test passed.
- The API workflow and health-check suites passed together, with 18 tests passing.

Rerun the test command after making changes to confirm the current result.

---

This repository is intended to demonstrate API automation, validation of authentication and authorization behavior, and repeatable testing of a database-backed booking workflow.