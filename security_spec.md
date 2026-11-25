# Security Specification: EduTrain AI (CM2)

## 1. Data Invariants
1. A student can only view and submit their own attempts and read exercises assigned to them or their class.
2. A student cannot read or write another student's attempts, progress or user profiles.
3. Solène De Pibrac (teacher) can read and write all student records, exercises, attempts, and reports within the CM2 class.
4. User profiles cannot have their role changed by normal students.
5. All IDs must conform to valid alphanumeric formats up to 128 characters.

## 2. Dirty Dozen Payloads (Designed to Fail)
1. **Privilege Escalation**: Student attempts to update their own role from 'student' to 'teacher'.
2. **Identity Spoofing**: Student submits an attempt with `studentId` set to another student's UID.
3. **Attempt Hijacking**: Student queries attempts belonging to another student.
4. **ID Poisoning**: Payload with 2KB string in document path or ID.
5. **Class Hijacking**: Student attempts to modify the CM2 class teacherId.
6. **Report Tampering**: Student attempts to read or write teacher reports.
7. **Negative or Infinite Score**: Attempt with invalid score types.
8. **Malicious Exercise Insertion**: Student creates exercises assigned to another student.
9. **Blanket Query Scraping**: Unauthenticated user attempts `list` on users collection.
10. **Shadow Key Injection**: Attempt submission containing injected admin boolean flags.
11. **Orphan Attempt**: Attempt created without valid exerciseId or studentId.
12. **PII Harvesting**: Student attempting to read all user emails.
