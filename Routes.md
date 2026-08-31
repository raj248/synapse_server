Here is the structured REST API route breakdown designed for Express.js 5 and Prisma 7.

---

### **1. Class & Membership Routes**

- `POST /api/v1/classes`
- **Desc:** Create a new class (generates unique `joinCode`, sets creator as author).

- `GET /api/v1/classes`
- **Desc:** List all classes current user is enrolled in or created.

- `GET /api/v1/classes/:classId`
- **Desc:** Fetch single class details, member count, and creator info.

- `PATCH /api/v1/classes/:classId`
- **Desc:** Update class name, subject, or description _(Author/Teacher only)_.

- `DELETE /api/v1/classes/:classId`
- **Desc:** Delete class and cascade delete all associated data _(Author only)_.

- `POST /api/v1/classes/join`
- **Desc:** Join a class using `joinCode`.

- `POST /api/v1/classes/:classId/leave`
- **Desc:** Current user leaves a class.

- `GET /api/v1/classes/:classId/members`
- **Desc:** List all members (teachers & students) in a class.

- `DELETE /api/v1/classes/:classId/members/:userId`
- **Desc:** Remove a specific student/member from class _(Author/Teacher only)_.

---

### **2. Syllabus Topics Routes**

- `POST /api/v1/classes/:classId/topics`
- **Desc:** Create a topic or sub-topic (pass `parentId` if sub-topic) _(Teacher only)_.

- `GET /api/v1/classes/:classId/topics`
- **Desc:** Get full hierarchical syllabus tree (topics with nested sub-topics).

- `GET /api/v1/topics/:topicId`
- **Desc:** Get single topic/sub-topic details, linked tasks, and attachments.

- `PATCH /api/v1/topics/:topicId`
- **Desc:** Update topic title, description, or `orderIndex` _(Teacher only)_.

- `PATCH /api/v1/topics/:topicId/status`
- **Desc:** Toggle topic completion status (`isCompleted`) _(Teacher only)_.

- `DELETE /api/v1/topics/:topicId`
- **Desc:** Delete topic/sub-topic _(Teacher only)_.

---

### **3. Task & Submission Routes**

- `POST /api/v1/classes/:classId/tasks`
- **Desc:** Create task, link to multiple `topicIds`, attach links/files _(Teacher only)_.

- `GET /api/v1/classes/:classId/tasks`
- **Desc:** List all tasks for a class (filter by category, topicId, or completion).

- `GET /api/v1/tasks/:taskId`
- **Desc:** Get single task with linked topics, attachments, and user submission status.

- `PATCH /api/v1/tasks/:taskId`
- **Desc:** Update task details, due date, or linked topic references _(Teacher only)_.

- `PATCH /api/v1/tasks/:taskId/status`
- **Desc:** Toggle progress status (`isCompleted`) _(Teacher only)_.

- `DELETE /api/v1/tasks/:taskId`
- **Desc:** Delete task _(Teacher only)_.

- `POST /api/v1/tasks/:taskId/submissions`
- **Desc:** Student submits work (allowed only if `isSubmissionRequired = true`).

- `GET /api/v1/tasks/:taskId/submissions`
- **Desc:** List all student submissions for a task _(Teacher only)_.

- `DELETE /api/v1/submissions/:submissionId`
- **Desc:** Student retracts/deletes their submission.

---

### **4. Announcement Routes**

- `POST /api/v1/classes/:classId/announcements`
- **Desc:** Create announcement (optionally link to `topicId` or `taskId`) _(Teacher only)_.

- `GET /api/v1/classes/:classId/announcements`
- **Desc:** Get paginated feed of class announcements with attachments.

- `GET /api/v1/announcements/:announcementId`
- **Desc:** Get specific announcement details.

- `PATCH /api/v1/announcements/:announcementId`
- **Desc:** Update announcement title or content _(Author/Teacher only)_.

- `DELETE /api/v1/announcements/:announcementId`
- **Desc:** Delete announcement _(Author/Teacher only)_.

---

### **5. Attachment Routes (Helpers)**

- `POST /api/v1/attachments`
- **Desc:** Upload or create an attachment entry (Link, Image, PDF) tied to a `classId`, `topicId`, `taskId`, `submissionId`, or `announcementId`.

- `DELETE /api/v1/attachments/:attachmentId`
- **Desc:** Remove attachment and delete file from Cloud Storage/disk.
