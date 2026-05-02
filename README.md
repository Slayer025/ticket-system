# 🎫 Serverless Ticket Triage & SLA Tracker

A full-stack serverless ticketing system built using AWS Lambda, DynamoDB, SQS, EventBridge, and a React frontend.  
It automates ticket creation, async triage, SLA monitoring, and operational visibility for support teams.

---

## 🚀 Live System

### 🌐 Frontend (AWS S3 Hosted)
http://ticket-frontend-declan.s3-website.ap-south-1.amazonaws.com/

---

### 🔗 Backend API Base URL
https://6z6t4ghhn6.execute-api.ap-south-1.amazonaws.com/Prod/

---

## 🔐 Authentication & Role-Based Access Control (RBAC)

The system uses **JWT authentication** with 3 roles:

---

### 🟥 ADMIN
- Full system access  
- Update any ticket  
- Assign / change owners  
- Change priority  
- Delete tickets  
- View all tickets  
- Full dashboard access  

---

### 🟧 AGENT
- Update any ticket  
- Assign owners  
- Change priority  
- Delete tickets  
- View all tickets  
- Operational support access  

---

### 🟩 USER (Requester)
- Register / login  
- Create tickets  
- View only own tickets  
- ❌ Cannot assign owners  
- ❌ Cannot change priority  
- ❌ Limited actions  

---

## 🔑 Test Credentials


```json
👑 ADMIN
{
  "email": "admin@example.com",
  "password": "Admin123"
}
🧑‍💻 AGENT
{
  "email": "ss",
  "password": "ss"
}
👤 USER
{
  "email": "ww",
  "password": "ww"
}
☁️ AWS Services Used
AWS Lambda (API handlers, workers, SLA processing)
Amazon API Gateway (REST endpoints)
Amazon DynamoDB (ticket storage + event history)
Amazon SQS (asynchronous triage queue)
Amazon EventBridge Scheduler (periodic SLA checks)
Amazon CloudWatch (logging and monitoring)
📦 Data Model
🧾 Ticket Item

PK: TICKET#<ticket_id>
SK: METADATA

Fields:

ticket_id
title
description
requester_id
team
status → NEW | TRIAGED | IN_PROGRESS | RESOLVED
priority → P1 | P2 | P3
category → INCIDENT | SERVICE_REQUEST
owner
sla_state → ON_TRACK | AT_RISK | BREACHED
sla_due_at
created_at
updated_at
🗂️ Event Log Item

PK: TICKET#<ticket_id>
SK: EVENT#<timestamp>

Tracks:

Ticket creation
Triage updates
Status changes
Ownership changes
SLA transitions
Deletion events
⚙️ Core Features
1️⃣ Ticket Intake
Create tickets via API/UI
Validates required fields
Stores in DynamoDB
Sends message to SQS
Returns ticket ID instantly
2️⃣ Async Triage Worker

Automatically:

Categorizes ticket
Assigns priority
Assigns owner
Updates DynamoDB
Writes event logs
3️⃣ SLA Monitoring System

⏱ SLA Duration: 8 hours from creation

States:

🟢 ON_TRACK
🟡 AT_RISK (≥ 80%)
🔴 BREACHED (past due)
4️⃣ Dashboard API
Open tickets
At-risk tickets
Breached tickets
5️⃣ Ticket Management
Update status
Assign owner
Change priority
Delete tickets (role-based)
Full event history tracking
🖥️ Frontend (React + Vite)
Features
JWT Login / Register
Role-based UI rendering
Create tickets
Edit tickets (admin/agent)
Dashboard counters
Search tickets
Live updates after actions
🔄 SLA Logic
🟡 AT_RISK → 80% time used
🔴 BREACHED → time exceeded
🟢 RESOLVED → excluded from SLA tracking
📊 Dashboard Metrics
Open tickets
At-risk tickets
Breached tickets
📁 Project Structure
backend/
  handlers/
    createTicket.js
    updateTicket.js
    deleteTicket.js
    dashboard.js
    triageWorker.js
    slaChecker.js
    slaCron.js
  template.yaml

frontend/
  src/
    App.jsx
    api.jsx
    Login.jsx
    Register.jsx
    index.css
🧪 Testing Flow

Login → Create Ticket → Triage → SLA → Update → Dashboard

🧾 Summary

This system demonstrates a full event-driven serverless architecture:

Async processing with SQS
DynamoDB Streams + EventBridge automation
SLA monitoring engine
Role-based access control (ADMIN / AGENT / USER)
Full ticket lifecycle management
Scalable React frontend hosted on S3
Fully AWS-native, cost-efficient design
