import { describe, it, expect, beforeEach } from "vitest"
import { mockBlockchain, mockPrincipal } from "./test-utils"

// Mock blockchain for testing
const blockchain = mockBlockchain()
const adminPrincipal = mockPrincipal("SP1ADMIN...")
const workerPrincipal = mockPrincipal("SP2WORKER...")
const otherPrincipal = mockPrincipal("SP3OTHER...")

describe("Worker Verification Contract", () => {
  beforeEach(() => {
    // Reset blockchain state before each test
    blockchain.reset()
    
    // Deploy contract with admin as deployer
    blockchain.deployContract("worker-verification", adminPrincipal)
  })
  
  describe("register-worker", () => {
    it("should allow a worker to register", () => {
      // Arrange
      const workerId = "worker123"
      const name = "John Doe"
      
      // Act
      const result = blockchain.callPublic({
        contract: "worker-verification",
        function: "register-worker",
        sender: workerPrincipal,
        args: [workerId, name],
      })
      
      // Assert
      expect(result.success).toBe(true)
      
      // Verify worker data was stored correctly
      const workerData = blockchain.getMapEntry("workers", { "worker-id": workerId })
      expect(workerData).toEqual({
        principal: workerPrincipal,
        name: name,
        verified: false,
        "registration-date": blockchain.currentBlockHeight,
      })
    })
    
  })
  
  describe("add-document", () => {
    it("should allow a worker to add a document", () => {
      // Arrange
      const workerId = "worker123"
      const name = "John Doe"
      const documentType = "identity"
      const documentHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      
      // Register worker first
      blockchain.callPublic({
        contract: "worker-verification",
        function: "register-worker",
        sender: workerPrincipal,
        args: [workerId, name],
      })
      
      // Act
      const result = blockchain.callPublic({
        contract: "worker-verification",
        function: "add-document",
        sender: workerPrincipal,
        args: [workerId, documentType, documentHash],
      })
      
      // Assert
      expect(result.success).toBe(true)
      
      // Verify document was stored correctly
      const docData = blockchain.getMapEntry("verified-documents", {
        "worker-id": workerId,
        "document-type": documentType,
      })
      
      expect(docData).toEqual({
        hash: documentHash,
        verified: false,
        "verification-date": 0,
      })
    })
    
    it("should not allow adding a document for a non-existent worker", () => {
      // Arrange
      const workerId = "worker123"
      const documentType = "identity"
      const documentHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      
      // Act - try to add document without registering
      const result = blockchain.callPublic({
        contract: "worker-verification",
        function: "add-document",
        sender: workerPrincipal,
        args: [workerId, documentType, documentHash],
      })
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe(2) // Error code 2
    })
    
    it("should not allow adding a document for another worker", () => {
      // Arrange
      const workerId = "worker123"
      const name = "John Doe"
      const documentType = "identity"
      const documentHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      
      // Register worker first
      blockchain.callPublic({
        contract: "worker-verification",
        function: "register-worker",
        sender: workerPrincipal,
        args: [workerId, name],
      })
      
      // Act - try to add document as different user
      const result = blockchain.callPublic({
        contract: "worker-verification",
        function: "add-document",
        sender: otherPrincipal,
        args: [workerId, documentType, documentHash],
      })
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe(3) // Error code 3
    })
  })
  
  describe("verify-document", () => {
    it("should allow admin to verify a document", () => {
      // Arrange
      const workerId = "worker123"
      const name = "John Doe"
      const documentType = "identity"
      const documentHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      
      // Register worker and add document
      blockchain.callPublic({
        contract: "worker-verification",
        function: "register-worker",
        sender: workerPrincipal,
        args: [workerId, name],
      })
      
      blockchain.callPublic({
        contract: "worker-verification",
        function: "add-document",
        sender: workerPrincipal,
        args: [workerId, documentType, documentHash],
      })
      
      // Act - verify document as admin
      const result = blockchain.callPublic({
        contract: "worker-verification",
        function: "verify-document",
        sender: adminPrincipal,
        args: [workerId, documentType],
      })
      
      // Assert
      expect(result.success).toBe(true)
      
      // Verify document status was updated
      const docData = blockchain.getMapEntry("verified-documents", {
        "worker-id": workerId,
        "document-type": documentType,
      })
      
      expect(docData.verified).toBe(true)
      expect(docData["verification-date"]).toBe(blockchain.currentBlockHeight)
    })
    
    it("should not allow non-admin to verify a document", () => {
      // Arrange
      const workerId = "worker123"
      const name = "John Doe"
      const documentType = "identity"
      const documentHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      
      // Register worker and add document
      blockchain.callPublic({
        contract: "worker-verification",
        function: "register-worker",
        sender: workerPrincipal,
        args: [workerId, name],
      })
      
      blockchain.callPublic({
        contract: "worker-verification",
        function: "add-document",
        sender: workerPrincipal,
        args: [workerId, documentType, documentHash],
      })
      
      // Act - try to verify document as non-admin
      const result = blockchain.callPublic({
        contract: "worker-verification",
        function: "verify-document",
        sender: workerPrincipal,
        args: [workerId, documentType],
      })
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe(5) // Error code 5 - not admin
    })
  })
  
  describe("verify-worker", () => {
    it("should allow admin to verify a worker", () => {
      // Arrange
      const workerId = "worker123"
      const name = "John Doe"
      
      // Register worker first
      blockchain.callPublic({
        contract: "worker-verification",
        function: "register-worker",
        sender: workerPrincipal,
        args: [workerId, name],
      })
      
      // Act - verify worker as admin
      const result = blockchain.callPublic({
        contract: "worker-verification",
        function: "verify-worker",
        sender: adminPrincipal,
        args: [workerId],
      })
      
      // Assert
      expect(result.success).toBe(true)
      
      // Verify worker status was updated
      const workerData = blockchain.getMapEntry("workers", { "worker-id": workerId })
      expect(workerData.verified).toBe(true)
    })
  })
  
  describe("is-worker-verified", () => {
    it("should return verification status correctly", () => {
      // Arrange
      const workerId = "worker123"
      const name = "John Doe"
      
      // Register worker first
      blockchain.callPublic({
        contract: "worker-verification",
        function: "register-worker",
        sender: workerPrincipal,
        args: [workerId, name],
      })
      
      // Act - check status before verification
      const beforeResult = blockchain.callReadOnly({
        contract: "worker-verification",
        function: "is-worker-verified",
        args: [workerId],
      })
      
      // Verify worker as admin
      blockchain.callPublic({
        contract: "worker-verification",
        function: "verify-worker",
        sender: adminPrincipal,
        args: [workerId],
      })
      
      // Act - check status after verification
      const afterResult = blockchain.callReadOnly({
        contract: "worker-verification",
        function: "is-worker-verified",
        args: [workerId],
      })
      
      // Assert
      expect(beforeResult.result).toBe(false)
      expect(afterResult.result).toBe(true)
    })
  })
  
  describe("transfer-admin", () => {
    it("should allow admin to transfer admin rights", () => {
      // Act
      const result = blockchain.callPublic({
        contract: "worker-verification",
        function: "transfer-admin",
        sender: adminPrincipal,
        args: [otherPrincipal],
      })
      
      // Assert
      expect(result.success).toBe(true)
      
      // Verify new admin can perform admin actions
      const verifyResult = blockchain.callPublic({
        contract: "worker-verification",
        function: "verify-worker",
        sender: otherPrincipal,
        args: ["some-worker-id"],
      })
      
      // This might fail for other reasons (worker not found), but not because of admin rights
      expect(verifyResult.error).not.toBe(5) // Error code 5 is for admin check
    })
    
    it("should not allow non-admin to transfer admin rights", () => {
      // Act
      const result = blockchain.callPublic({
        contract: "worker-verification",
        function: "transfer-admin",
        sender: workerPrincipal,
        args: [otherPrincipal],
      })
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe(5) // Error code 5 - not admin
    })
  })
})

