# 🎫 Serverless Ticket Triage & SLA Tracker

A full-stack serverless ticketing system built using AWS Lambda, DynamoDB, SQS, EventBridge, and a React frontend.  
It automates ticket creation, async triage, SLA monitoring, and operational visibility for support teams.

---

# 🚀 Live System

## Frontend (Local Dev)
http://localhost:5173

## Backend API Base URL
https://oned7urh22.execute-api.ap-south-1.amazonaws.com/Prod/

---

# ☁️ AWS Services Used

- AWS Lambda (API handlers, workers, SLA processing)
- Amazon API Gateway (REST endpoints)
- Amazon DynamoDB (ticket storage + event history)
- Amazon SQS (asynchronous triage queue)
- Amazon EventBridge Scheduler (periodic SLA checks)
- Amazon CloudWatch (logging and monitoring)

---

# 📦 Data Model

## Ticket Item

PK: TICKET#<ticket_id>  
SK: METADATA  

### Fields

- ticket_id
- title
- description
- requester
- team
- status (NEW | TRIAGED | IN_PROGRESS | RESOLVED)
- priority (P1 | P2 | P3)
- category (INCIDENT | SERVICE_REQUEST)
- owner
- sla_state (ON_TRACK | AT_RISK | BREACHED)
- sla_due_at
- created_at
- updated_at

---

## Event Log Item

PK: TICKET#<ticket_id>  
SK: EVENT#<timestamp>  

### Tracks

- ticket creation
- triage updates
- status changes
- ownership changes
- SLA transitions
- deletion events

---

# ⚙️ Core Features

## 1. Ticket Intake
- Create tickets via API or UI
- Validates required fields
- Stores ticket in DynamoDB
- Sends message to SQS for async processing
- Returns ticket ID immediately

---

## 2. Async Triage Worker
- Consumes messages from SQS
- Assigns:
  - Category (incident / service request)
  - Priority (P1 / P2 / P3)
  - Owner (based on team rules)
- Updates ticket state in DynamoDB
- Writes event log entry

---

## 3. SLA Monitoring System
- SLA duration: 8 hours from creation

### SLA States
- ON_TRACK
- AT_RISK (≥80% elapsed)
- BREACHED (past SLA deadline)

### Triggered via
- DynamoDB Streams (real-time updates)
- EventBridge Scheduler (every 5 minutes)

---

## 4. Dashboard API
Provides operational summary:

- Open tickets
- At-risk tickets
- Breached tickets

---

## 5. Ticket Management
- Update ticket status
- Reassign owner
- Delete ticket
- Full event history preserved

---

# 🖥️ Frontend (React + Vite)

## Features
- Create Ticket form
- Ticket list view
- Edit modal (status + owner)
- SLA dashboard counters
- Search by ticket ID
- Auto-refresh after updates

---

## Run Locally

```bash
cd frontend
npm install
npm run dev
Production Deployment Options
Option 1: Vercel (Recommended)
Connect GitHub repository
Auto-deploy React app
Free tier supported
Option 2: AWS S3 + CloudFront
npm run build

Then:

Upload /dist folder to S3 bucket
Enable static website hosting
Attach CloudFront CDN
🔄 SLA Logic

SLA Duration: 8 hours

AT_RISK
When progress >= 80%
BREACHED
When current time > sla_due_at
RESOLVED
Excluded from SLA tracking
📊 Dashboard Metrics
Open tickets (not resolved)
At-risk tickets
Breached tickets
🚀 Deployment
Backend (AWS SAM)
sam build
sam deploy
Clean Build (if needed)
Remove-Item -Recurse -Force .aws-sam
📁 Project Structure
backend/
  handlers/
    createTicket.js
    updateTicket.js
    deleteTicket.js
    dashboard.js
    triageWorker.js
    slaStream.js
    slaCron.js
  template.yaml

frontend/
  src/
    App.jsx
    main.jsx
    index.css
🧪 Testing Approach
API tested using Postman
Frontend tested via UI flows
CloudWatch logs used for debugging
End-to-end workflow:
Create → Triage → SLA → Update → Dashboard

🧾 Summary

This system demonstrates a complete serverless workflow:

Event-driven architecture using SQS and DynamoDB Streams
Asynchronous processing with Lambda workers
SLA tracking and automation
Full CRUD ticket lifecycle
Operational dashboard for monitoring
React-based frontend interface
Cost-efficient AWS serverless design
