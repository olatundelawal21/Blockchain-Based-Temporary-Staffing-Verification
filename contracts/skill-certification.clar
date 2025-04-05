;; Skill Certification Contract
;; Records specific competencies and training

(define-data-var admin principal tx-sender)

;; Skill data structure
(define-map skills
  { skill-id: (string-ascii 36) }
  {
    name: (string-ascii 50),
    category: (string-ascii 30),
    created-at: uint
  }
)

;; Worker skill certifications
(define-map worker-skills
  { worker-id: (string-ascii 36), skill-id: (string-ascii 36) }
  {
    certified-by: principal,
    certification-date: uint,
    expiration-date: (optional uint),
    level: uint,  ;; 1-5 skill level
    proof-hash: (optional (buff 32))
  }
)

;; Create a new skill (admin only)
(define-public (create-skill (skill-id (string-ascii 36)) (name (string-ascii 50)) (category (string-ascii 30)))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u1))
    (asserts! (is-none (map-get? skills { skill-id: skill-id })) (err u2))
    (ok (map-set skills
      { skill-id: skill-id }
      {
        name: name,
        category: category,
        created-at: block-height
      }
    ))
  )
)

;; Certify a worker's skill (admin or authorized certifier only)
(define-public (certify-skill
  (worker-id (string-ascii 36))
  (skill-id (string-ascii 36))
  (level uint)
  (expiration-date (optional uint))
  (proof-hash (optional (buff 32))))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u1))
    (asserts! (is-some (map-get? skills { skill-id: skill-id })) (err u3))
    (asserts! (and (>= level u1) (<= level u5)) (err u4))
    (ok (map-set worker-skills
      { worker-id: worker-id, skill-id: skill-id }
      {
        certified-by: tx-sender,
        certification-date: block-height,
        expiration-date: expiration-date,
        level: level,
        proof-hash: proof-hash
      }
    ))
  )
)

;; Get a worker's skill certification
(define-read-only (get-worker-skill (worker-id (string-ascii 36)) (skill-id (string-ascii 36)))
  (map-get? worker-skills { worker-id: worker-id, skill-id: skill-id })
)

;; Check if a worker's skill is certified and not expired
(define-read-only (is-skill-valid (worker-id (string-ascii 36)) (skill-id (string-ascii 36)))
  (let
    ((skill-data (map-get? worker-skills { worker-id: worker-id, skill-id: skill-id })))
    (if (is-none skill-data)
      false
      (let
        ((expiry (get expiration-date (unwrap-panic skill-data))))
        (if (is-none expiry)
          true
          (< block-height (unwrap-panic expiry))
        )
      )
    )
  )
)

;; Get skill details
(define-read-only (get-skill-details (skill-id (string-ascii 36)))
  (map-get? skills { skill-id: skill-id })
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u5))
    (ok (var-set admin new-admin))
  )
)

