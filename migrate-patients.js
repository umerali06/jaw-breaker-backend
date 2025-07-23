import mongoose from "mongoose";
import Patient from "./models/Patient.js";
import User from "./models/User.js";

await mongoose.connect("mongodb://localhost:27017/jawbreaker");

const user = await User.findOne();
if (!user) {
  console.log("No user found");
  process.exit(1);
}
const result = await Patient.updateMany(
  { userId: { $exists: false } },
  { $set: { userId: user._id } }
);
console.log("Updated patients:", result.modifiedCount);
process.exit(0);
BFFF4RRR;
