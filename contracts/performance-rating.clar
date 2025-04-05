;; Performance Rating Contract
;; Stores feedback from employers

(define-data-var admin principal tx-sender)

;; Rating data structure (1-5 scale)
(define-map ratings
  { assignment-id: (string-ascii 36) }
  {
    employer: principal,
    worker-id: (string-ascii 36),
    rating: uint,
    feedback: (string-ascii 500),
    created-at: uint
  }
)

;; Worker aggregate ratings
(define-map worker-aggregate-ratings
  { worker-id: (string-ascii 36) }
  {
    total-ratings: uint,
    sum-ratings: uint,
    last-updated: uint
  }
)

;; Submit a rating for a completed assignment
(define-public (submit-rating
  (assignment-id (string-ascii 36))
  (worker-id (string-ascii 36))
  (rating uint)
  (feedback (string-ascii 500)))
  (let
    ((caller tx-sender))
    (begin
      ;; Validate rating is between 1-5
      (asserts! (and (>= rating u1) (<= rating u5)) (err u1))

      ;; Check if rating already exists
      (asserts! (is-none (map-get? ratings { assignment-id: assignment-id })) (err u2))

      ;; Submit the rating
      (map-set ratings
        { assignment-id: assignment-id }
        {
          employer: caller,
          worker-id: worker-id,
          rating: rating,
          feedback: feedback,
          created-at: block-height
        }
      )

      ;; Update aggregate ratings
      (update-aggregate-rating worker-id rating)

      (ok true)
    )
  )
)

;; Private function to update aggregate ratings
(define-private (update-aggregate-rating (worker-id (string-ascii 36)) (rating uint))
  (let
    ((current-aggregate (default-to
                         { total-ratings: u0, sum-ratings: u0, last-updated: u0 }
                         (map-get? worker-aggregate-ratings { worker-id: worker-id })))
     (new-total (+ u1 (get total-ratings current-aggregate)))
     (new-sum (+ rating (get sum-ratings current-aggregate))))
    (map-set worker-aggregate-ratings
      { worker-id: worker-id }
      {
        total-ratings: new-total,
        sum-ratings: new-sum,
        last-updated: block-height
      }
    )
  )
)

;; Get a specific rating
(define-read-only (get-rating (assignment-id (string-ascii 36)))
  (map-get? ratings { assignment-id: assignment-id })
)

;; Get a worker's aggregate rating
(define-read-only (get-worker-rating (worker-id (string-ascii 36)))
  (let
    ((aggregate (map-get? worker-aggregate-ratings { worker-id: worker-id })))
    (if (is-none aggregate)
      { average: u0, total-ratings: u0 }
      (let
        ((agg (unwrap-panic aggregate))
         (total (get total-ratings agg))
         (sum (get sum-ratings agg)))
        (if (is-eq total u0)
          { average: u0, total-ratings: u0 }
          {
            average: (/ (* sum u100) total), ;; Multiply by 100 for 2 decimal precision
            total-ratings: total
          }
        )
      )
    )
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u3))
    (ok (var-set admin new-admin))
  )
)

