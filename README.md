🎫 Serverless Ticket Triage & SLA Tracker

A full-stack, event-driven ticketing system built using AWS Serverless services and a React frontend.
It automates ticket intake, async triage, SLA monitoring, and operational dashboards.

🚀 Live Application
Frontend (Local Dev)
http://localhost:5173
API Base URL
https://oned7urh22.execute-api.ap-south-1.amazonaws.com/Prod/
🏗️ System Architecture
☁️ AWS Services Used
AWS Lambda (API, worker, SLA engine)
Amazon API Gateway (REST APIs)
Amazon DynamoDB (ticket storage + event logs)
Amazon SQS (async triage processing)
Amazon EventBridge Scheduler (SLA evaluation)
Amazon CloudWatch (logging & monitoring)
📦 Data Model
Ticket Item
PK: TICKET#<ticket_id>
SK: METADATA
Fields
ticket_id
title
description
requester
team
status (NEW | TRIAGED | IN_PROGRESS | RESOLVED)
priority (P1 | P2 | P3)
category (INCIDENT | SERVICE_REQUEST)
owner
sla_state (ON_TRACK | AT_RISK | BREACHED)
sla_due_at
created_at
updated_at
Event Log Item
PK: TICKET#<ticket_id>
SK: EVENT#<timestamp>

Tracks:

creation
triage
updates
SLA changes
deletions
⚙️ Core Features
1. Ticket Intake
Create ticket via API or UI
Stores ticket in DynamoDB
Sends message to SQS for async processing
Returns ticket ID instantly
2. Async Triage Worker
Consumes SQS messages
Assigns:
Category (incident / service request)
Priority (P1 / P2 / P3)
Owner (based on team rules)
Updates ticket in DynamoDB
Logs event history
3. SLA Monitoring System
SLA window: 8 hours
States:
ON_TRACK
AT_RISK (≥80%)
BREACHED (past due)
Triggered via:
DynamoDB Streams
EventBridge Scheduler (every 5 minutes)
4. Dashboard API
Open tickets
At-risk tickets
Breached tickets
Aggregated operational metrics
5. Ticket Management
Update status (NEW → TRIAGED → IN_PROGRESS → RESOLVED)
Reassign owner
Delete ticket (with event logging)
🖥️ Frontend (React + Vite)
Features
Create Ticket Form
Ticket Table View
Edit Ticket Modal (status + owner)
SLA Dashboard Cards
Search by Ticket ID
Real-time refresh after actions
Run Frontend Locally
cd frontend
npm install
npm run dev
Production Deployment Options
Option 1: Vercel (Recommended)
Connect GitHub repo
Auto deploy React app
Free hosting
No configuration needed
Option 2: AWS S3 + CloudFront
npm run build

Then:

Upload /dist folder to S3
Enable static website hosting
Attach CloudFront CDN
🔄 SLA Logic
SLA Duration: 8 hours

AT_RISK:
  when progress >= 80%

BREACHED:
  when current time > sla_due_at

RESOLVED:
  excluded from SLA tracking
📊 Dashboard Metrics
Open tickets (not resolved)
At-risk tickets
Breached tickets
🧪 Testing Approach
API tested using Postman
Frontend tested manually via UI
Logs verified in CloudWatch
End-to-end workflow tested via:
Create → Triage → SLA → Update → Dashboard
🚀 Deployment
Backend (AWS SAM)
sam build
sam deploy
Local Cleanup (if needed)
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
🔮 Future Enhancements
Authentication (Cognito)
Email notifications (SES)
GSI-based dashboard (remove Scan)
Dead Letter Queue replay UI
Advanced filtering and pagination
Real-time WebSocket updates
🧾 Summary

This project demonstrates a complete serverless workflow:

Event-driven architecture (SQS + Streams)
Async processing with Lambda workers
SLA monitoring system
Full CRUD ticket lifecycle
React-based operational UI
AWS-native scalable design<img width="2483" height="2041" alt="mermaid-diagram" src="https://github.com/user-attachments/assets/2466786d-f3e9-412a-9d7f-cd783cd5e672" />
