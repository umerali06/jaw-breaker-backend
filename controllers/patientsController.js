import Patient from "../models/Patient.js";

// Create a new patient (authenticated)
export const createPatient = async (req, res) => {
  try {
    // Validate required fields
    const { name, age, gender, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Patient name is required",
      });
    }

    if (!age || isNaN(Number(age)) || Number(age) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid age is required",
      });
    }

    if (!gender) {
      return res.status(400).json({
        success: false,
        message: "Gender is required",
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const patient = new Patient({
      ...req.body,
      userId: req.userId,
    });

    await patient.save();
    res.status(201).json({ success: true, patient });
  } catch (error) {
    console.error("Error creating patient:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all patients for the current user (authenticated)
export const getAllPatients = async (req, res) => {
  try {
    console.log("Fetching patients for userId:", req.userId); // Debug log

    const { page = 1, limit = 50, search, condition } = req.query; // Increased default limit
    const skip = (page - 1) * limit;

    // Build query
    let query = { userId: req.userId };

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by condition
    if (condition) {
      query.condition = condition;
    }

    console.log("Query:", query); // Debug log

    const patients = await Patient.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Patient.countDocuments(query);

    console.log(`Found ${patients.length} patients out of ${total} total`); // Debug log

    res.json({
      success: true,
      patients,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: patients.length,
        totalRecords: total,
      },
    });
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get a single patient by ID (authenticated)
export const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findOne({
      _id: id,
      userId: req.userId,
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({ success: true, patient });
  } catch (error) {
    console.error("Error fetching patient:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update a patient (authenticated)
export const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const patient = await Patient.findOneAndUpdate(
      { _id: id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({ success: true, patient });
  } catch (error) {
    console.error("Error updating patient:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete a patient (authenticated)
export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await Patient.findOneAndDelete({
      _id: id,
      userId: req.userId,
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    res.json({
      success: true,
      message: "Patient deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting patient:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get patient statistics (authenticated)
export const getPatientStats = async (req, res) => {
  try {
    const userId = req.userId;

    // Get total count
    const totalPatients = await Patient.countDocuments({ userId });

    // Get condition breakdown
    const conditionStats = await Patient.aggregate([
      { $match: { userId: req.userId } },
      { $group: { _id: "$condition", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Get recent patients (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPatients = await Patient.countDocuments({
      userId,
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get gender breakdown
    const genderStats = await Patient.aggregate([
      { $match: { userId: req.userId } },
      { $group: { _id: "$gender", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      stats: {
        total: totalPatients,
        recent: recentPatients,
        conditions: conditionStats,
        genders: genderStats,
      },
    });
  } catch (error) {
    console.error("Error fetching patient stats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  createPatient,
  getAllPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  getPatientStats,
};
