import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { EventEmitter } from "events";

class PatientCommunicationWebSocket extends EventEmitter {
  constructor() {
    super();
    this.wss = null;
    this.connections = new Map(); // userId -> Set of WebSocket connections
    this.patientRooms = new Map(); // patientId -> Set of userIds
    this.userPatients = new Map(); // userId -> Set of patientIds
    this.heartbeatInterval = null;
  }

  // Initialize WebSocket server
  initialize(server, options = {}) {
    this.wss = new WebSocketServer({
      server,
      path: "/ws/patient-communication",
      ...options,
    });

    this.wss.on("connection", (ws, request) => {
      this.handleConnection(ws, request);
    });

    // Set up heartbeat to detect broken connections
    this.setupHeartbeat();

    console.log("🔌 Patient Communication WebSocket initialized");
  }

  // Handle new WebSocket connection
  async handleConnection(ws, request) {
    try {
      // Extract token from query parameters
      const url = new URL(request.url, `http://localhost:5000`);
      const token = url.searchParams.get('token');
      
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
      ws.patientRooms = new Set();

      // Add to connections map
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Set());
      }
      this.connections.get(userId).add(ws);

      // Set up message handlers
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to patient communication service',
        userId: userId
      }));

      console.log(`🔌 Patient Communication WebSocket connected: User ${userId}`);

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1008, "Authentication failed");
    }
  }

  // Handle incoming messages
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'join_patient_room':
          this.joinPatientRoom(ws, message.patientId);
          break;
        case 'leave_patient_room':
          this.leavePatientRoom(ws, message.patientId);
          break;
        case 'typing':
          this.handleTyping(ws, message);
          break;
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  // Join a patient room
  joinPatientRoom(ws, patientId) {
    if (!patientId) return;

    ws.patientRooms.add(patientId);

    // Add to patient rooms map
    if (!this.patientRooms.has(patientId)) {
      this.patientRooms.set(patientId, new Set());
    }
    this.patientRooms.get(patientId).add(ws.userId);

    // Add to user patients map
    if (!this.userPatients.has(ws.userId)) {
      this.userPatients.set(ws.userId, new Set());
    }
    this.userPatients.get(ws.userId).add(patientId);

    // Notify other users in the room
    this.broadcastToPatientRoom(patientId, {
      type: 'user_joined',
      userId: ws.userId,
      patientId: patientId
    }, ws.userId);

    console.log(`User ${ws.userId} joined patient room ${patientId}`);
  }

  // Leave a patient room
  leavePatientRoom(ws, patientId) {
    if (!patientId) return;

    ws.patientRooms.delete(patientId);

    // Remove from patient rooms map
    if (this.patientRooms.has(patientId)) {
      this.patientRooms.get(patientId).delete(ws.userId);
      if (this.patientRooms.get(patientId).size === 0) {
        this.patientRooms.delete(patientId);
      }
    }

    // Remove from user patients map
    if (this.userPatients.has(ws.userId)) {
      this.userPatients.get(ws.userId).delete(patientId);
      if (this.userPatients.get(ws.userId).size === 0) {
        this.userPatients.delete(ws.userId);
      }
    }

    // Notify other users in the room
    this.broadcastToPatientRoom(patientId, {
      type: 'user_left',
      userId: ws.userId,
      patientId: patientId
    }, ws.userId);

    console.log(`User ${ws.userId} left patient room ${patientId}`);
  }

  // Handle typing indicators
  handleTyping(ws, message) {
    this.broadcastToPatientRoom(message.patientId, {
      type: 'typing',
      userId: ws.userId,
      patientId: message.patientId,
      isTyping: message.isTyping
    }, ws.userId);
  }

  // Broadcast message to all users in a patient room
  broadcastToPatientRoom(patientId, message, excludeUserId = null) {
    if (!this.patientRooms.has(patientId)) return;

    const userIds = this.patientRooms.get(patientId);
    userIds.forEach(userId => {
      if (userId === excludeUserId) return;
      
      const userConnections = this.connections.get(userId);
      if (userConnections) {
        userConnections.forEach(ws => {
          if (ws.readyState === 1) { // WebSocket.OPEN
            ws.send(JSON.stringify(message));
          }
        });
      }
    });
  }

  // Send message to specific user
  sendToUser(userId, message) {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.forEach(ws => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(JSON.stringify(message));
        }
      });
    }
  }

  // Handle disconnection
  handleDisconnection(ws) {
    const userId = ws.userId;
    
    // Remove from all patient rooms
    if (ws.patientRooms) {
      ws.patientRooms.forEach(patientId => {
        this.leavePatientRoom(ws, patientId);
      });
    }

    // Remove from connections
    if (this.connections.has(userId)) {
      this.connections.get(userId).delete(ws);
      if (this.connections.get(userId).size === 0) {
        this.connections.delete(userId);
      }
    }

    console.log(`🔌 Patient Communication WebSocket disconnected: User ${userId}`);
  }

  // Set up heartbeat to detect broken connections
  setupHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.connections.forEach((userConnections, userId) => {
        userConnections.forEach(ws => {
          if (ws.isAlive === false) {
            console.log(`Terminating dead connection for user ${userId}`);
            ws.terminate();
            return;
          }
          ws.isAlive = false;
          ws.ping();
        });
      });
    }, 30000); // 30 seconds
  }

  // Broadcast new communication to patient room
  broadcastNewCommunication(communication) {
    if (communication.patientId) {
      this.broadcastToPatientRoom(communication.patientId, {
        type: 'new_communication',
        communication: communication
      });
    }
  }

  // Broadcast updated communication to patient room
  broadcastUpdatedCommunication(communication) {
    if (communication.patientId) {
      this.broadcastToPatientRoom(communication.patientId, {
        type: 'updated_communication',
        communication: communication
      });
    }
  }

  // Broadcast deleted communication to patient room
  broadcastDeletedCommunication(communicationId, patientId) {
    if (patientId) {
      this.broadcastToPatientRoom(patientId, {
        type: 'deleted_communication',
        communicationId: communicationId
      });
    }
  }

  // Get connection count
  getConnectionCount() {
    let total = 0;
    this.connections.forEach(userConnections => {
      total += userConnections.size;
    });
    return total;
  }

  // Get patient room count
  getPatientRoomCount() {
    return this.patientRooms.size;
  }

  // Cleanup
  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    this.connections.clear();
    this.patientRooms.clear();
    this.userPatients.clear();
  }
}

export default PatientCommunicationWebSocket;
