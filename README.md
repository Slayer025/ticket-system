🎫 Serverless Ticket Triage & SLA Tracker

A full-stack serverless ticketing system built using AWS Lambda, DynamoDB, SQS, EventBridge, and a React frontend.
It automates ticket creation, async triage, SLA monitoring, and operational visibility for support teams.

🚀 Live System
🌐 Frontend (AWS S3 Hosted)

http://ticket-frontend-declan.s3-website.ap-south-1.amazonaws.com/

🔗 Backend API Base URL

https://oned7urh22.execute-api.ap-south-1.amazonaws.com/Prod/

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

Fields
ticket_id
title
description
requester
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

Tracks
Ticket creation
Triage updates
Status changes
Ownership changes
SLA transitions
Deletion events
⚙️ Core Features
1️⃣ Ticket Intake
Create tickets via API or UI
Validates required fields
Stores ticket in DynamoDB
Sends message to SQS for async processing
Returns ticket ID immediately
2️⃣ Async Triage Worker
Consumes messages from SQS
Automatically assigns:
Category (Incident / Service Request)
Priority (P1 / P2 / P3)
Owner (based on team rules)
Updates ticket in DynamoDB
Writes event log entry
3️⃣ SLA Monitoring System

SLA Duration: 8 hours from ticket creation

SLA States
🟢 ON_TRACK
🟡 AT_RISK (≥ 80% time elapsed)
🔴 BREACHED (past deadline)
Triggered via
DynamoDB Streams (real-time updates)
EventBridge Scheduler (every 5 minutes)
4️⃣ Dashboard API

Provides operational insights:

Open tickets
At-risk tickets
Breached tickets
5️⃣ Ticket Management
Update ticket status
Reassign owner
Delete tickets
Full event history maintained
🖥️ Frontend (React + Vite)
Features
Create Ticket form
Ticket list view
Edit modal (status + owner)
SLA dashboard counters
Search by ticket ID
Auto-refresh after updates
🧪 Run Locally (Optional)
cd frontend
npm install
npm run dev
🚀 Deployment
Backend (AWS SAM)
sam build
sam deploy
Clean Build (if needed)
rm -rf .aws-sam
Frontend Deployment (AWS S3)
npm run build

Then:

Upload /dist folder to S3 bucket
Enable static website hosting
(Optional) Attach CloudFront CDN
🔄 SLA Logic
SLA Duration: 8 hours
AT_RISK

Triggered when ≥ 80% of SLA time is consumed

BREACHED

Triggered when current time exceeds sla_due_at

RESOLVED

Excluded from SLA tracking

📊 Dashboard Metrics
Open tickets (not resolved)
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
    main.jsx
    index.css
🧪 Testing Approach
API tested using Postman
Frontend tested via UI workflows
CloudWatch logs used for debugging
End-to-End Flow

Create → Triage → SLA → Update → Dashboard

🧾 Summary

This project demonstrates a complete event-driven serverless architecture:

Asynchronous processing using SQS
Event-driven workflows with DynamoDB Streams
Automated SLA tracking system
Full ticket lifecycle management (CRUD)
Operational dashboard for visibility
Scalable React frontend hosted on S3
Cost-efficient AWS-native design
