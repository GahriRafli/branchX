# PRD: TheLeads Enterprise Task Management System

**Project Owner:** Product Development Team  
**Status:** Final Draft (V2.1)  
**Target Launch:** Q2 2026  

---

## 1. Executive Summary
TheLeads is a centralized task management and document intelligence dashboard. It allows Administrators to bridge the gap between unstructured data (Excel, CSV, PDF) and actionable workflows by automatically generating task tables and assigning them to team members for real-time progress monitoring.

## 2. User Roles & Access Control (RBAC)

### 2.1 Admin User
* **User Management:** Create, update, view, and deactivate user accounts.
* **Data Ingestion:** Upload **Excel (.xlsx)**, **CSV**, and **PDF** files.
* **Task Generation:** Automatically convert uploaded files into structured table rows.
* **Assignment:** Assign specific tasks to "Standard Users."
* **Global Monitoring:** View a bird’s-eye dashboard of all task statuses (To Do, In Progress, Blocker, Done).
* **Advanced Control:** Perform multi-column filtering, sorting, and editing across all tasks.

### 2.2 Standard User
* **Personal Dashboard:** View only tasks assigned to them.
* **Task Execution:** View task details and update the task status.
* **Status Workflow:** Transition tasks through `To Do`, `In Progress`, `Blocker`, and `Done`.

## 3. Core Functional Requirements

### 3.1 File Processing & Automation
* **Excel/CSV Parser:** System must map columns from uploaded spreadsheets to the task table fields.
* **PDF Intelligence:** Extract text/data from PDF documents to populate the task description and title.
* **Auto-Generation:** Upon successful upload, data must instantly appear in the web dashboard without page refresh.

### 3.2 Dynamic Data Table
* **Column Filtering:** Users can filter every column (e.g., filter by "Status" or "Date").
* **Sorting:** Ascending and descending sort capability for every field (Assignee, Priority, Title).
* **Status Management:** A dropdown in each row to toggle between `In Progress` and `Blocker` for immediate visibility of bottlenecks.

### 3.3 Dashboard & Monitoring
* **Admin View:** High-level charts (Pie/Bar) showing overall team productivity and "Blocker" counts.
* **User View:** Focus-oriented list of pending items.

## 4. Technical Stack (Recommended)

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React.js / Next.js with **TanStack Table** (for advanced filtering/sorting). |
| **Backend** | Node.js (Express) or Python (FastAPI). |
| **Database** | PostgreSQL or MySQL (Relational DB to link Users and Tasks). |
| **File Parsing** | `xlsx` (Excel), `csv-parser` (CSV), `pdf-parse` or `Tesseract.js` (PDF). |
| **Auth** | JWT (JSON Web Tokens) with Secure Cookie Storage. |

## 5. System Workflow (User Flow)

1.  **Authentication:** Admin/User logs in; system redirects based on Role.
2.  **Upload (Admin):** Admin uploads a project file (Excel/CSV/PDF).
3.  **Parsing:** Backend validates and stores data; UI reflects a new table of tasks.
4.  **Assignment:** Admin assigns a task to a Standard User.
5.  **Update (User):** Standard User updates status to "In Progress."
6.  **Monitoring (Admin):** Admin sees the live update on the monitoring dashboard.
7.  **Logout:** Secure session termination.

## 6. Success Metrics (KPIs)
* **Upload Efficiency:** Time taken from file upload to table generation (Target: < 3s).
* **User Adoption:** Percentage of tasks updated by Standard Users within 24h of assignment.
* **Blocker Resolution:** Average time a task remains in the "Blocker" status.

## 7. Future Considerations
* **Real-time Notifications:** Web-push or Email alerts when a status is changed to "Blocker."
* **History Logs:** Tracking who changed what status and when (Audit Trail).