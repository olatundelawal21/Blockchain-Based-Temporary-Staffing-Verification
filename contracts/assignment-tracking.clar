;; Assignment Tracking Contract
;; Manages temporary work placements

(define-data-var admin principal tx-sender)

;; Assignment status enum: 0=pending, 1=active, 2=completed, 3=cancelled
(define-constant STATUS-PENDING u0)
(define-constant STATUS-ACTIVE u1)
(define-constant STATUS-COMPLETED u2)
(define-constant STATUS-CANCELLED u3)

;; Assignment data structure
(define-map assignments
  { assignment-id: (string-ascii 36) }
  {
    employer: principal,
    worker-id: (string-ascii 36),
    title: (string-ascii 50),
    description: (string-ascii 255),
    start-date: uint,
    end-date: uint,
    status: uint,
    required-skills: (list 10 (string-ascii 36)),
    created-at: uint
  }
)

;; Assignment history for tracking status changes
(define-map assignment-history
  { assignment-id: (string-ascii 36), sequence: uint }
  {
    status: uint,
    updated-by: principal,
    updated-at: uint,
    notes: (optional (string-ascii 100))
  }
)

;; Sequence counter for assignment history
(define-map assignment-sequence
  { assignment-id: (string-ascii 36) }
  { current: uint }
)

;; Create a new assignment
(define-public (create-assignment
  (assignment-id (string-ascii 36))
  (worker-id (string-ascii 36))
  (title (string-ascii 50))
  (description (string-ascii 255))
  (start-date uint)
  (end-date uint)
  (required-skills (list 10 (string-ascii 36))))
  (let
    ((caller tx-sender))
    (begin
      (asserts! (is-none (map-get? assignments { assignment-id: assignment-id })) (err u1))
      (asserts! (<= start-date end-date) (err u2))

      ;; Create the assignment
      (map-set assignments
        { assignment-id: assignment-id }
        {
          employer: caller,
          worker-id: worker-id,
          title: title,
          description: description,
          start-date: start-date,
          end-date: end-date,
          status: STATUS-PENDING,
          required-skills: required-skills,
          created-at: block-height
        }
      )

      ;; Initialize sequence counter
      (map-set assignment-sequence
        { assignment-id: assignment-id }
        { current: u0 }
      )

      ;; Add first history entry
      (add-history-entry assignment-id STATUS-PENDING none)

      (ok true)
    )
  )
)

;; Update assignment status
(define-public (update-assignment-status
  (assignment-id (string-ascii 36))
  (new-status uint)
  (notes (optional (string-ascii 100))))
  (let
    ((caller tx-sender)
     (assignment (unwrap! (map-get? assignments { assignment-id: assignment-id }) (err u3))))
    (begin
      ;; Check authorization
      (asserts! (or
        (is-eq caller (get employer assignment))
        (is-eq caller (var-get admin)))
        (err u4))

      ;; Validate status transition
      (asserts! (and (>= new-status u0) (<= new-status u3)) (err u5))
      (asserts! (not (is-eq (get status assignment) new-status)) (err u6))

      ;; Update assignment status
      (map-set assignments
        { assignment-id: assignment-id }
        (merge assignment { status: new-status })
      )

      ;; Add history entry
      (add-history-entry assignment-id new-status notes)

      (ok true)
    )
  )
)

;; Private function to add history entry
(define-private (add-history-entry
  (assignment-id (string-ascii 36))
  (status uint)
  (notes (optional (string-ascii 100))))
  (let
    ((sequence-data (default-to { current: u0 }
                     (map-get? assignment-sequence { assignment-id: assignment-id })))
     (next-sequence (+ u1 (get current sequence-data))))
    (begin
      ;; Update sequence counter
      (map-set assignment-sequence
        { assignment-id: assignment-id }
        { current: next-sequence }
      )

      ;; Add history entry
      (map-set assignment-history
        { assignment-id: assignment-id, sequence: next-sequence }
        {
          status: status,
          updated-by: tx-sender,
          updated-at: block-height,
          notes: notes
        }
      )

      true
    )
  )
)

;; Get assignment details
(define-read-only (get-assignment (assignment-id (string-ascii 36)))
  (map-get? assignments { assignment-id: assignment-id })
)

;; Get assignment history entry
(define-read-only (get-assignment-history-entry (assignment-id (string-ascii 36)) (sequence uint))
  (map-get? assignment-history { assignment-id: assignment-id, sequence: sequence })
)

;; Get current sequence number for an assignment
(define-read-only (get-assignment-history-count (assignment-id (string-ascii 36)))
  (default-to { current: u0 } (map-get? assignment-sequence { assignment-id: assignment-id }))
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u7))
    (ok (var-set admin new-admin))
  )
)

