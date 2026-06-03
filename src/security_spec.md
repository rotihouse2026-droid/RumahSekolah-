# Firestore Security Specification: RumahSekolah

## Data Invariants
1. A **User** profile can only be created and managed by the owner (`uid` match).
2. An **Order** must belong to an authenticated user (if signed in) and its status transitions are restricted.
3. **Products** and **Settings** are read-only for public/customers, and writeable only by Admins.
4. **Reviews** must be authored by the signed-in user and linked to a valid product.
5. **Notifications** and **PointTransactions** are strictly user-private and mostly system-managed (Admin-managed).
6. **Payment Slips** are for verifying orders and should only be viewable by Admins.

## The Dirty Dozen Payloads (Attack Scenarios)

1. **Identity Spoofing (Users Collection)**
   - Payload: `{"uid": "other_user_id", "displayName": "Attacker", "points": 1000000}`
   - Target: `create /users/victim_id` (as Attacker)
   - Reason for Denial: Attacker cannot create a profile for someone else or set their own points.

2. **Privilege Escalation (Users Collection)**
   - Payload: `{"role": "admin"}`
   - Target: `update /users/attacker_id` (as Attacker)
   - Reason for Denial: Users cannot change their own role to admin.

3. **Orphaned Order (Orders Collection)**
   - Payload: `{"items": [], "total": 0, "status": "shipped"}`
   - Target: `create /orders/order_123`
   - Reason for Denial: Orders must have valid structure and status must start as 'pending'.

4. **Shadow Field Injection (Orders Collection)**
   - Payload: `{"items": [...], "total": 100, "status": "pending", "isPaid": true}`
   - Target: `create /orders/order_123`
   - Reason for Denial: `isPaid` is not a valid field in the schema (Shadow Update Test).

5. **State Shortcut (Orders Collection)**
   - Payload: `{"status": "delivered"}`
   - Target: `update /orders/order_123` (from 'pending')
   - Reason for Denial: Customers cannot jump status directly to 'delivered'.

6. **ID Poisoning (Products Collection)**
   - Target: `create /products/very-long-string-over-128-chars-designed-to-exhaust-resources-or-break-lookups`
   - Reason for Denial: Document IDs must be strictly validated for size and format.

7. **Coupon Scraping (Coupons Collection)**
   - Action: `list /coupons`
   - Reason for Denial: Customers should not be able to list all coupons; they should only be able to 'get' specific ones if they know the code.

8. **Review Forgery (Reviews Collection)**
   - Payload: `{"uid": "victim_id", "rating": 5, "text": "Fake Review"}`
   - Target: `create /reviews/review_123`
   - Reason for Denial: `uid` in the review must match the authenticated user.

9. **Notification Tampering (Notifications Collection)**
   - Payload: `{"status": "read", "message": "You won a car!"}`
   - Target: `update /notifications/notif_123`
   - Reason for Denial: Regular users can only update the `status` field, not the message content.

10. **Point Theft (PointTransactions Collection)**
    - Payload: `{"userId": "attacker_id", "type": "earn", "points": 5000}`
    - Target: `create /pointTransactions/trans_1`
    - Reason for Denial: Point transactions should be created by the system (Admin account/Cloud Functions) or strictly validated against an active order.

11. **PII Leak (Users Collection)**
    - Action: `get /users/victim_id` (as Guest or other User)
    - Reason for Denial: User profiles containing sensitive info (points, email) must be restricted to the owner.

12. **slip Injection (Slips Collection)**
    - Payload: `{"orderId": "someone_elses_order", "url": "...", "uid": "attacker_id"}`
    - Target: `create /slips/slip_123`
    - Reason for Denial: Slips must be linked to a valid order and the uploader should be the order owner.
