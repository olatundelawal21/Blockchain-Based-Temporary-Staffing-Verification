import { describe, it, expect, beforeEach } from "vitest"
import { mockBlockchain, mockPrincipal } from "./test-utils"

// Mock blockchain for testing
const blockchain = mockBlockchain()
const adminPrincipal = mockPrincipal("SP1ADMIN...")
const workerPrincipal = mockPrincipal("SP2WORKER...")
const otherPrincipal = mockPrincipal("SP3OTHER...")

describe("Skill Certification Contract", () => {
  beforeEach(() => {
    // Reset blockchain state before each test
    blockchain.reset()
    
    // Deploy contract with admin as deployer
    blockchain.deployContract("skill-certification", adminPrincipal)
  })
  
  describe("create-skill", () => {
    it("should allow admin to create a skill", () => {
      // Arrange
      const skillId = "skill123"
      const name = "JavaScript"
      const category = "Programming"
      
      // Act
      const result = blockchain.callPublic({
        contract: "skill-certification",
        function: "create-skill",
        sender: adminPrincipal,
        args: [skillId, name, category],
      })
      
      // Assert
      expect(result.success).toBe(true)
      
      // Verify skill data was stored correctly
      const skillData = blockchain.getMapEntry("skills", { "skill-id": skillId })
      expect(skillData).toEqual({
        name: name,
        category: category,
        "created-at": blockchain.currentBlockHeight,
      })
    })
    
    it("should not allow non-admin to create a skill", () => {
      // Arrange
      const skillId = "skill123"
      const name = "JavaScript"
      const category = "Programming"
      
      // Act
      const result = blockchain.callPublic({
        contract: "skill-certification",
        function: "create-skill",
        sender: workerPrincipal,
        args: [skillId, name, category],
      })
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe(1) // Error code 1 - not admin
    })
    
    it("should not allow creating a skill with an existing ID", () => {
      // Arrange
      const skillId = "skill123"
      const name = "JavaScript"
      const category = "Programming"
      
      // Create skill once
      blockchain.callPublic({
        contract: "skill-certification",
        function: "create-skill",
        sender: adminPrincipal,
        args: [skillId, name, category],
      })
      
      // Act - try to create again
      const result = blockchain.callPublic({
        contract: "skill-certification",
        function: "create-skill",
        sender: adminPrincipal,
        args: [skillId, "Python", "Programming"],
      })
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe(2) // Error code 2 - skill already exists
    })
  })
  
  describe("certify-skill", () => {
    it("should allow admin to certify a worker skill", () => {
      // Arrange
      const skillId = "skill123"
      const workerId = "worker123"
      const skillLevel = 4
      
      // Create skill first
      blockchain.callPublic({
        contract: "skill-certification",
        function: "create-skill",
        sender: adminPrincipal,
        args: [skillId, "JavaScript", "Programming"],
      })
      
      // Act
      const result = blockchain.callPublic({
        contract: "skill-certification",
        function: "certify-skill",
        sender: adminPrincipal,
        args: [workerId, skillId, skillLevel, null, null],
      })
      
      // Assert
      expect(result.success).toBe(true)
      
      // Verify certification was stored correctly
      const certData = blockchain.getMapEntry("worker-skills", {
        "worker-id": workerId,
        "skill-id": skillId,
      })
      
      expect(certData).toEqual({
        "certified-by": adminPrincipal,
        "certification-date": blockchain.currentBlockHeight,
        "expiration-date": null,
        level: skillLevel,
        "proof-hash": null,
      })
    })
    
    it("should not allow certifying a non-existent skill", () => {
      // Arrange
      const skillId = "nonexistent"
      const workerId = "worker123"
      const skillLevel = 4
      
      // Act
      const result = blockchain.callPublic({
        contract: "skill-certification",
        function: "certify-skill",
        sender: adminPrincipal,
        args: [workerId, skillId, skillLevel, null, null],
      })
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe(3) // Error code 3 - skill not found
    })
    
    it("should not allow invalid skill levels", () => {
      // Arrange
      const skillId = "skill123"
      const workerId = "worker123"
      const invalidLevel = 6 // Valid range is 1-5
      
      // Create skill first
      blockchain.callPublic({
        contract: "skill-certification",
        function: "create-skill",
        sender: adminPrincipal,
        args: [skillId, "JavaScript", "Programming"],
      })
      
      // Act
      const result = blockchain.callPublic({
        contract: "skill-certification",
        function: "certify-skill",
        sender: adminPrincipal,
        args: [workerId, skillId, invalidLevel, null, null],
      })
      
      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe(4) // Error code 4 - invalid level
    })
  })
  
  describe("is-skill-valid", () => {
    it("should return true for valid non-expiring certification", () => {
      // Arrange
      const skillId = "skill123"
      const workerId = "worker123"
      const skillLevel = 4
      
      // Create skill and certify
      blockchain.callPublic({
        contract: "skill-certification",
        function: "create-skill",
        sender: adminPrincipal,
        args: [skillId, "JavaScript", "Programming"],
      })
      
      blockchain.callPublic({
        contract: "skill-certification",
        function: "certify-skill",
        sender: adminPrincipal,
        args: [workerId, skillId, skillLevel, null, null],
      })
      
      // Act
      const result = blockchain.callReadOnly({
        contract: "skill-certification",
        function: "is-skill-valid",
        args: [workerId, skillId],
      })
      
      // Assert
      expect(result.result).toBe(true)
    })
    
    it("should return false for expired certification", () => {
      // Arrange
      const skillId = "skill123"
      const workerId = "worker123"
      const skillLevel = 4
      const expirationDate = blockchain.currentBlockHeight - 1 // Already expired
      
      // Create skill and certify with expiration
      blockchain.callPublic({
        contract: "skill-certification",
        function: "create-skill",
        sender: adminPrincipal,
        args: [skillId, "JavaScript", "Programming"],
      })
      
      blockchain.callPublic({
        contract: "skill-certification",
        function: "certify-skill",
        sender: adminPrincipal,
        args: [workerId, skillId, skillLevel, expirationDate, null],
      })
      
      // Act
      const result = blockchain.callReadOnly({
        contract: "skill-certification",
        function: "is-skill-valid",
        args: [workerId, skillId],
      })
      
      // Assert
      expect(result.result).toBe(false)
    })
    
    it("should return false for non-existent certification", () => {
      // Act
      const result = blockchain.callReadOnly({
        contract: "skill-certification",
        function: "is-skill-valid",
        args: ["nonexistent", "nonexistent"],
      })
      
      // Assert
      expect(result.result).toBe(false)
    })
  })
})

