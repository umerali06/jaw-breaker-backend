import WebSocket from "ws";
import jwt from "jsonwebtoken";
import { EventEmitter } from "events";

class WebSocketManager extends EventEmitter {
  constructor() {
    super();
    this.wss = null;
    this.connections = new Map(); // userId -> Set of WebSocket connections
    this.rooms = new Map(); // roomId -> Set of userIds
    this.userRooms = new Map(); // userId -> Set of roomIds
    this.heartbeatInterval = null;
    this.reconnectAttempts = new Map(); // userId -> attempt count
    this.maxReconnectAttempts = 5;
  }

  // Initialize WebSocket server
  initialize(server, options = {}) {
    this.wss = new WebSocket.Server({
      server,
      path: "/ws/nursing",
      ...options,
    });

    this.wss.on("connection", (ws, request) => {
      this.handleConnection(ws, request);
    });

    // Set up heartbeat to detect broken connections
    this.setupHeartbeat();

    console.log("🔌 WebSocket Manager initialized for nursing features");
  }

  // Handle new WebSocket connection
  async handleConnection(ws, request) {
    try {
      // Extract token from query parameters or headers
      const token = this.extractToken(request);
      if (!token) {
        ws.close(1008, "Authentication required");
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      // Set up connection metadata
      ws.userId = userId;
      ws.isAlive = true;
      ws.connectedAt = new Date();
      ws.lastActivity = new Date();

      // Add to connections map
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }
      this.connections.get(userId).add(ws);

      // Set up event handlers
      this.setupConnectionHandlers(ws);

      // Send connection confirmation
      this.sendToConnection(ws, {
        type: "connection_established",
        data: {
          userId,
          connectedAt: ws.connectedAt,
          features: [
            "oasis",
            "soap",
            "progress",
            "outcomes",
            "medications",
            "assessments",
            "clinical-support",
            "care-plans",
          ],
        },
      });

      // Reset reconnect attempts
      this.reconnectAttempts.delete(userId);

      console.log(`👤 User ${userId} connected to nursing WebSocket`);
      this.emit("user_connected", {
        userId,
        connectionCount: this.connections.get(userId).size,
      });
    } catch (error) {
      console.error("WebSocket connection error:", error);
      ws.close(1008, "Authentication failed");
    }
  }

  // Extract token from request
  extractToken(request) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token =
      url.searchParams.get("token") ||
      request.headers.authorization?.replace("Bearer ", "");
    return token;
  }

  // Setup socket handlers (alias for setupConnectionHandlers)
  setupSocketHandlers(ws) {
    return this.setupConnectionHandlers(ws);
  }

  // Set up connection event handlers
  setupConnectionHandlers(ws) {
    // Handle incoming messages
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(ws, message);
        ws.lastActivity = new Date();
      } catch (error) {
        console.error("Invalid message format:", error);
        this.sendError(ws, "Invalid message format");
      }
    });

    // Handle connection close
    ws.on("close", (code, reason) => {
      this.handleDisconnection(ws, code, reason);
    });

    // Handle connection errors
    ws.on("error", (error) => {
      console.error(`WebSocket error for user ${ws.userId}:`, error);
      this.handleDisconnection(ws, 1006, "Connection error");
    });

    // Handle pong responses for heartbeat
    ws.on("pong", () => {
      ws.isAlive = true;
      ws.lastActivity = new Date();
    });
  }

  // Handle incoming messages
  handleMessage(ws, message) {
    const { type, data, roomId } = message;

    switch (type) {
      case "join_room":
        this.joinRoom(ws.userId, data.roomId);
        break;

      case "leave_room":
        this.leaveRoom(ws.userId, data.roomId);
        break;

      case "nursing_update":
        this.handleNursingUpdate(ws, data);
        break;

      case "real_time_collaboration":
        this.handleCollaboration(ws, data, roomId);
        break;

      case "subscribe":
        this.handleSubscription(ws, data);
        break;

      case "ping":
        this.sendToConnection(ws, { type: "pong", timestamp: Date.now() });
        break;

      default:
        this.sendError(ws, `Unknown message type: ${type}`);
    }
  }

  // Handle nursing-specific updates
  handleNursingUpdate(ws, data) {
    const { feature, action, payload } = data;

    // Emit event for other services to handle
    this.emit("nursing_update", {
      userId: ws.userId,
      feature,
      action,
      payload,
      timestamp: new Date(),
    });

    // Broadcast to relevant users (same patient, care team, etc.)
    if (payload.patientId) {
      this.broadcastToPatientCareTeam(
        payload.patientId,
        {
          type: "nursing_update",
          data: {
            userId: ws.userId,
            feature,
            action,
            payload,
          },
        },
        ws.userId
      ); // Exclude sender
    }
  }

  // Handle real-time collaboration
  handleCollaboration(ws, data, roomId) {
    const { documentType, documentId, operation, content } = data;

    // Broadcast collaboration event to room members
    this.broadcastToRoom(
      roomId,
      {
        type: "collaboration_update",
        data: {
          userId: ws.userId,
          documentType,
          documentId,
          operation,
          content,
          timestamp: Date.now(),
        },
      },
      ws.userId
    ); // Exclude sender

    // Emit for persistence
    this.emit("collaboration_update", {
      userId: ws.userId,
      roomId,
      documentType,
      documentId,
      operation,
      content,
      timestamp: new Date(),
    });
  }

  // Handle subscription requests
  handleSubscription(ws, data) {
    const { channel, patientId } = data;

    switch (channel) {
      case "care-plans":
        // Join care plans room for this patient or general care plans
        const roomId = patientId
          ? `care-plans-${patientId}`
          : "care-plans-general";
        this.joinRoom(ws.userId, roomId);

        this.sendToConnection(ws, {
          type: "subscription_confirmed",
          data: {
            channel,
            roomId,
            patientId,
            timestamp: Date.now(),
          },
        });
        break;

      default:
        this.sendError(ws, `Unknown subscription channel: ${channel}`);
    }
  }

  // Handle disconnection
  handleDisconnection(ws, code, reason) {
    if (!ws.userId) return;

    const userId = ws.userId;

    // Remove from connections
    if (this.connections.has(userId)) {
      this.connections.get(userId).delete(ws);
      if (this.connections.get(userId).size === 0) {
        this.connections.delete(userId);

        // Remove from all rooms
        if (this.userRooms.has(userId)) {
          for (const roomId of this.userRooms.get(userId)) {
            this.leaveRoom(userId, roomId);
          }
        }
      }
    }

    console.log(
      `👤 User ${userId} disconnected (code: ${code}, reason: ${reason})`
    );
    this.emit("user_disconnected", { userId, code, reason });
  }

  // Room management
  joinRoom(userId, roomId) {
    // Add user to room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(userId);

    // Add room to user's rooms
    if (!this.userRooms.has(userId)) {
      this.userRooms.set(userId, new Set());
    }
    this.userRooms.get(userId).add(roomId);

    // Notify room members
    this.broadcastToRoom(
      roomId,
      {
        type: "user_joined_room",
        data: { userId, roomId, timestamp: Date.now() },
      },
      userId
    );

    console.log(`👤 User ${userId} joined room ${roomId}`);
  }

  leaveRoom(userId, roomId) {
    // Remove user from room
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).delete(userId);
      if (this.rooms.get(roomId).size === 0) {
        this.rooms.delete(roomId);
      }
    }

    // Remove room from user's rooms
    if (this.userRooms.has(userId)) {
      this.userRooms.get(userId).delete(roomId);
      if (this.userRooms.get(userId).size === 0) {
        this.userRooms.delete(userId);
      }
    }

    // Notify room members
    this.broadcastToRoom(
      roomId,
      {
        type: "user_left_room",
        data: { userId, roomId, timestamp: Date.now() },
      },
      userId
    );

    console.log(`👤 User ${userId} left room ${roomId}`);
  }

  // Broadcasting methods
  broadcastToRoom(roomId, message, excludeUserId = null) {
    if (!this.rooms.has(roomId)) return;

    for (const userId of this.rooms.get(roomId)) {
      if (userId !== excludeUserId) {
        this.sendToUser(userId, message);
      }
    }
  }

  broadcastToPatientCareTeam(patientId, message, excludeUserId = null) {
    // This would typically query the database for care team members
    // For now, broadcast to a room based on patientId
    const roomId = `patient_${patientId}`;
    this.broadcastToRoom(roomId, message, excludeUserId);
  }

  sendToUser(userId, message) {
    if (!this.connections.has(userId)) return false;

    const userConnections = this.connections.get(userId);
    let sent = false;

    for (const ws of userConnections) {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendToConnection(ws, message);
        sent = true;
      }
    }

    return sent;
  }

  sendToConnection(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendError(ws, error) {
    this.sendToConnection(ws, {
      type: "error",
      data: { message: error, timestamp: Date.now() },
    });
  }

  // Heartbeat to detect broken connections
  setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          console.log(`💔 Terminating dead connection for user ${ws.userId}`);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  // Public API methods
  notifyNursingUpdate(feature, action, payload, targetUsers = null) {
    const message = {
      type: "nursing_notification",
      data: {
        feature,
        action,
        payload,
        timestamp: Date.now(),
      },
    };

    if (targetUsers) {
      // Send to specific users
      for (const userId of targetUsers) {
        this.sendToUser(userId, message);
      }
    } else {
      // Broadcast to all connected users
      for (const userId of this.connections.keys()) {
        this.sendToUser(userId, message);
      }
    }
  }

  // Care plan specific notifications
  notifyCarePlanCreated(carePlan, patientId = null) {
    const roomId = patientId ? `care-plans-${patientId}` : "care-plans-general";
    this.broadcastToRoom(roomId, {
      type: "care_plan_created",
      carePlan,
      timestamp: Date.now(),
    });
  }

  notifyCarePlanUpdated(carePlan, changes = null, patientId = null) {
    const roomId = patientId ? `care-plans-${patientId}` : "care-plans-general";
    this.broadcastToRoom(roomId, {
      type: "care_plan_updated",
      carePlan,
      changes,
      timestamp: Date.now(),
    });
  }

  notifyCarePlanDeleted(carePlanId, planName, patientId = null) {
    const roomId = patientId ? `care-plans-${patientId}` : "care-plans-general";
    this.broadcastToRoom(roomId, {
      type: "care_plan_deleted",
      carePlanId,
      planName,
      timestamp: Date.now(),
    });
  }

  // Get connection statistics
  getStats() {
    return {
      totalConnections: Array.from(this.connections.values()).reduce(
        (sum, connections) => sum + connections.size,
        0
      ),
      uniqueUsers: this.connections.size,
      activeRooms: this.rooms.size,
      uptime: process.uptime(),
    };
  }

  // Cleanup
  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        ws.close(1001, "Server shutting down");
      });
      this.wss.close();
    }

    this.connections.clear();
    this.rooms.clear();
    this.userRooms.clear();
    this.reconnectAttempts.clear();

    console.log("🔌 WebSocket Manager shut down");
  }
}

export default WebSocketManager;
