;; Worker Verification Contract
;; Validates identity and qualifications of temporary workers

(define-data-var admin principal tx-sender)

;; Worker data structure
(define-map workers
  { worker-id: (string-ascii 36) }
  {
    principal: principal,
    name: (string-ascii 50),
    verified: bool,
    registration-date: uint
  }
)

;; Document verification map
(define-map verified-documents
  { worker-id: (string-ascii 36), document-type: (string-ascii 20) }
  {
    hash: (buff 32),
    verified: bool,
    verification-date: uint
  }
)

;; Register a new worker
(define-public (register-worker (worker-id (string-ascii 36)) (name (string-ascii 50)))
  (let
    ((caller tx-sender))
    (begin
      (asserts! (not (default-to false (get verified (map-get? workers { worker-id: worker-id })))) (err u1))
      (ok (map-set workers
        { worker-id: worker-id }
        {
          principal: caller,
          name: name,
          verified: false,
          registration-date: block-height
        }
      ))
    )
  )
)

;; Add a document for verification
(define-public (add-document (worker-id (string-ascii 36)) (document-type (string-ascii 20)) (document-hash (buff 32)))
  (let
    ((caller tx-sender)
     (worker-data (unwrap! (map-get? workers { worker-id: worker-id }) (err u2))))
    (begin
      (asserts! (is-eq caller (get principal worker-data)) (err u3))
      (ok (map-set verified-documents
        { worker-id: worker-id, document-type: document-type }
        {
          hash: document-hash,
          verified: false,
          verification-date: u0
        }
      ))
    )
  )
)

;; Verify a worker's document (admin only)
(define-public (verify-document (worker-id (string-ascii 36)) (document-type (string-ascii 20)))
  (let
    ((caller tx-sender)
     (doc-data (unwrap! (map-get? verified-documents { worker-id: worker-id, document-type: document-type }) (err u4))))
    (begin
      (asserts! (is-eq caller (var-get admin)) (err u5))
      (ok (map-set verified-documents
        { worker-id: worker-id, document-type: document-type }
        {
          hash: (get hash doc-data),
          verified: true,
          verification-date: block-height
        }
      ))
    )
  )
)

;; Verify a worker (admin only)
(define-public (verify-worker (worker-id (string-ascii 36)))
  (let
    ((caller tx-sender)
     (worker-data (unwrap! (map-get? workers { worker-id: worker-id }) (err u2))))
    (begin
      (asserts! (is-eq caller (var-get admin)) (err u5))
      (ok (map-set workers
        { worker-id: worker-id }
        {
          principal: (get principal worker-data),
          name: (get name worker-data),
          verified: true,
          registration-date: (get registration-date worker-data)
        }
      ))
    )
  )
)

;; Check if a worker is verified
(define-read-only (is-worker-verified (worker-id (string-ascii 36)))
  (default-to false (get verified (map-get? workers { worker-id: worker-id })))
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u5))
    (ok (var-set admin new-admin))
  )
)

