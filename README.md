# 🎓 ExamMatrix

**ExamMatrix** is a web-based **Examination Management and Seating Allocation System** designed to simplify the process of creating examinations, allocating students to available halls, and generating conflict-free seating arrangements.

The system uses examination, student, subject, hall, date, and time-slot information to automatically organize examinations and seating arrangements while detecting scheduling conflicts and preventing students taking the same examination from being seated next to each other.

---

## ✨ Features

* 📅 **Exam Generation** — Create examination schedules using subjects, students, examination dates, time slots, and available halls.

* 🏫 **Hall Allocation** — Allocate students to examination halls according to hall capacity and hall availability for the selected date and time slot.

* 🛡️ **Conflict-Free Seating / Anti-Cheat Seating** — A constraint-based seating algorithm ensures that students appearing for the same examination are not seated adjacent to each other. The system checks **front, back, left, and right** positions and distributes students across available seats and halls where possible.

* ⚠️ **Clash Detection** — Detect scheduling conflicts when a student or examination hall is already assigned to another examination during the same date and time slot.

* 🏫 **Time-Aware Hall Booking** — Hall availability is managed according to the examination date and time slot. A hall booked for one time slot can become available again for another slot, preventing unnecessary blocking of halls.

* 🪑 **Seating Arrangement** — Automatically generate and visualize student-specific seating arrangements inside examination halls.

* 📊 **Dashboard** — View examination information and access the major examination management features from a centralized dashboard.

* 👨‍🎓 **Student & Subject Data** — Student and subject information is loaded from JSON data files and used during examination generation and seating allocation.

* 📈 **Exam Visualization** — View generated examinations, hall allocations, and seating arrangements through clear visual representations.

* 🔎 **Find My Seat** — Students can search for their assigned examination hall and seat.

* 📅 **Timetable** — Students can view their examination subject, date, time, and related examination information.

---

## 🛡️ Conflict-Free Seating Algorithm

One of the key features of ExamMatrix is its **conflict-free seating algorithm**.

The system is designed to prevent students taking the **same examination** from sitting directly next to each other.

For each student, the seating logic considers adjacent positions:

```text
             FRONT
               ↑
               │
        ┌──────┴──────┐
        │    Seat     │
        └──────┬──────┘
               │
      ← LEFT   │   RIGHT →
               │
        ┌──────┴──────┐
        │    BACK     │
        └─────────────┘
```

The algorithm checks the surrounding seats and attempts to place students in positions where their examination subject does not conflict with neighboring students.

If necessary, the system can distribute students across different halls and use available buffer seats to reduce adjacency conflicts.

This makes the seating arrangement more than a simple sequential seat assignment — it applies **constraints to reduce opportunities for collaboration between students taking the same examination**.

---

## ⚠️ Clash Detection

ExamMatrix also performs **clash detection** during examination planning.

The system checks whether:

* A student is assigned to multiple examinations at the same date and time.
* A hall is already booked for another examination during the same date and time slot.
* A new examination conflicts with an existing examination arrangement.

This helps prevent invalid examination schedules before seating arrangements are generated.

---

## 🏫 Time-Aware Hall Booking

Hall allocation is **time-aware** rather than treating a hall as permanently unavailable after it has been used once.

For example:

```text
Hall A

10:00 AM ──► Mathematics Exam
             🔒 BOOKED

02:00 PM ──► Physics Exam
             🟢 AVAILABLE
```

A hall is therefore considered booked according to its **date + time slot**.

This allows the same hall to be reused for different examinations when their time slots do not overlap.

---

## 🛠️ Technologies Used

* **HTML5**
* **CSS3**
* **JavaScript**
* **JSON**
* **Git & GitHub**

---

## 🚀 Getting Started

Clone the repository:

```bash
git clone https://github.com/I-Manmeet/ExamMatrix.git
```

Open the project in **VS Code** and run it using **Live Server**.

---

## 🎯 Objective

The objective of **ExamMatrix** is to automate and simplify examination planning by:

* Creating examination schedules
* Detecting scheduling clashes
* Allocating students to available halls
* Managing hall availability according to time slots
* Generating conflict-free seating arrangements
* Providing students with their examination and seating information

The system aims to reduce manual examination planning and improve the organization, efficiency, and reliability of examination seating.

---

# 🔄 Project Workflow

ExamMatrix follows a structured workflow from authentication and examination creation to hall allocation, conflict-free seating, and student-specific examination information.

```text
┌─────────────────────────┐
│       🔐 LOGIN          │
│                         │
│   User Authentication   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│      📊 DASHBOARD       │
│                         │
│  Examination Overview   │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  📅 EXAM CREATION               │
│                                 │
│  Exam Name • Date • Time Slot   │
│  Subjects • Students            │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   ⚠️ CLASH DETECTION            │
│                                 │
│ Student Clash • Hall Clash      │
│ Same Date + Time Slot           │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│     🏫 HALL ALLOCATION          │
│                                 │
│ Hall Capacity + Availability    │
│ Date + Time-Slot Based Booking  │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   🛡️ CONFLICT-FREE SEATING     │
│                                 │
│ Check Adjacent Seats            │
│ Front • Back • Left • Right     │
│ Avoid Same-Exam Neighbours      │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────┐
│   🪑 SEATING ARRANGEMENT│
│                         │
│ Student → Hall → Seat   │
└────────────┬────────────┘
             │
             ▼
        ┌────┴────┐
        │         │
        ▼         ▼
┌──────────────┐  ┌──────────────────┐
│ 📅 TIMETABLE │  │ 🔎 FIND MY SEAT  │
│              │  │                  │
│ Exam Details │  │ Student Name     │
│ Subject      │  │ Exam Hall        │
│ Date         │  │ Assigned Seat    │
│ Time         │  │ Exam Information │
└──────┬───────┘  └────────┬─────────┘
       │                   │
       ▼                   ▼
┌──────────────┐   ┌──────────────────┐
│ 👨‍🎓 STUDENT  │   │ 👨‍🎓 STUDENT      │
│     VIEW     │   │      VIEW        │
│              │   │                  │
│ "WHEN IS     │   │ "WHERE DO I      │
│  MY EXAM?"   │   │  HAVE TO SIT?"   │
└──────────────┘   └──────────────────┘
```

---

## 🔹 Workflow Summary

**Index Page → Login/Register → Dashboard → Exam Creation → Clash Detection → Hall Allocation → Conflict-Free Seating → Student Services**

ExamMatrix takes examination and student information, checks for scheduling conflicts, allocates students to available halls based on capacity and time-slot availability, generates conflict-free seating arrangements, and finally provides students with their examination and seating information.

---

## 🌐 1. Index Page

When the website is opened, the user first reaches the **ExamMatrix Index Page**, which introduces the system and provides access to the application.

---

## 🔐 2. Login / Register

The user can log in or register to access the examination management system.

After successful authentication, the user is redirected to the **Dashboard**.

---

## 📊 3. Dashboard

The Dashboard provides an overview of the examination system and allows users to access the main examination management features.

---

## 📅 4. Exam Creation

The examination creation process collects the information required to generate an examination arrangement.

The user provides details such as:

* Exam Name
* Examination Date
* Time Slot
* Subject
* Students
* Available Halls

The system uses these details as the input for clash detection, hall allocation, and seating generation.

> **Note:** Semester is not listed because it is not currently collected as an input in the examination creation interface.

---

## ⚠️ 5. Clash Detection

Before allocating halls and generating seats, ExamMatrix checks for scheduling conflicts.

The system verifies:

```text
Student
   │
   ├── Already assigned to another exam?
   │
   └── Same Date + Same Time Slot?
             │
             ▼
          ⚠️ CLASH
```

It also checks hall availability for the selected date and time slot.

This prevents students and halls from being unintentionally assigned to overlapping examinations.

---

## 🏫 6. Hall Allocation

After the examination passes the required checks, students are allocated to available examination halls.

The allocation considers:

* Hall capacity
* Number of students
* Examination date
* Examination time slot
* Existing hall bookings

A hall booked for one time slot can be reused during another non-overlapping time slot.

---

## 🛡️ 7. Conflict-Free Seating

After students have been allocated to halls, ExamMatrix generates their seating arrangement.

The seating algorithm checks neighboring positions to avoid placing students appearing for the **same examination** next to each other.

The system considers:

* Left
* Right
* Front
* Back

The objective is to distribute students taking the same examination and reduce direct adjacency wherever possible.

---

## 🪑 8. Seating Arrangement

The final seating arrangement connects each student with:

```text
Student
   ↓
Examination
   ↓
Hall
   ↓
Seat Number
```

The generated arrangement can then be visualized through the seating interface.

---

## 👨‍🎓 9. Student Services

Once examination and seating information has been generated, students can access their information through two major services:

```text
                 👨‍🎓 STUDENT
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
   📅 TIMETABLE              🔎 FIND MY SEAT
          │                         │
          ▼                         ▼
    What is my exam?         Where do I sit?
          │                         │
          ▼                         ▼
   Subject • Date • Time     Name • Hall • Seat
```

### 📅 Timetable

Students can view **what examination they have and when it is**, including:

* Subject
* Date
* Time
* Examination details

### 🔎 Find My Seat

Students can find **where they have to sit**, including:

* Student Name
* Examination Hall
* Assigned Seat
* Examination Information

---

## 🎯 In Simple Terms

> **ExamMatrix takes exam and student details → detects clashes → allocates available halls → generates conflict-free seats → provides the final examination and seating information to students.**

### Core System Flow

**Exam Creation → Clash Detection → Time-Aware Hall Allocation → Conflict-Free Seating → Student Information**

---

# ⭐ Project Highlights

ExamMatrix combines **examination scheduling, clash detection, time-aware hall allocation, and conflict-free seating generation** into one examination management workflow.

### 🏠 Home Page

<img src="assets/screenshots/index.png" width="600" height="400">

---

### 🔐 Signup & Login

<table>
  <tr>
    <td align="center">
      <img src="assets/screenshots/register.png" width="250" height="280">
    </td>
    <td align="center">
      <img src="assets/screenshots/login.png" width="250" height="280">
    </td>
  </tr>
</table>

---

### 📊 Dashboard

<img src="assets/screenshots/dashboard.png" width="600" height="500">

---

### 📅 Exam Creation & Hall Allocation

<img src="assets/screenshots/createExam.png" width="600" height="500">

---

### 🛡️ Conflict-Free Seating

<img src="assets/screenshots/Seating.png" width="500" height="500">

---

### 🔎 Find My Seat

<img src="assets/screenshots/findMySeat.png" width="450" height="300">

---

### 📅 Timetable

<img src="assets/screenshots/image.png" width="500" height="500">

---

# 🔮 Future Improvements

* **🔐 Secure Backend & Database Integration** — Store and manage examinations, students, halls, and seating data securely using a centralized database.

* **🤖 Advanced Automated Exam Scheduling** — Automatically schedule examinations based on subjects, student groups, available halls, and time-slot constraints.

* **🧠 Optimized Seating Algorithms** — Further improve seating allocation using advanced constraint-solving and optimization techniques to maximize conflict-free placements and hall utilization.

* **☁️ Scalable Cloud-Based Deployment** — Deploy ExamMatrix on cloud infrastructure to provide reliable access, scalability, and improved performance.

* **📱 Enhanced Student Experience** — Provide a more personalized student dashboard with examination reminders, hall information, and seating details.

---

# 👥 Contributors

* **I-Manmeet** — [@I-Manmeet](https://github.com/I-Manmeet)

* **Anupam** — [@Anupamshraddha](https://github.com/Anupamshraddha)

* **Jiya** — [@JiyaJindal3210](https://github.com/JiyaJindal3210)


