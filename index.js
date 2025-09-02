const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
console.log('MongoDB URI:', MONGODB_URI ? 'Set' : 'Not set');

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
}

// Student Schema
const studentSchema = new mongoose.Schema({
  student_id: { type: String, required: true, unique: true },
  student_name: { type: String, required: true },
  total_marks: { type: Number, required: true },
  marks_obtained: { type: Number, required: true },
  percentage: { type: Number, required: true },
  created_at: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', studentSchema);

// MINIMAL ROUTES ONLY
app.get('/', (req, res) => {
  res.json({ message: 'Student Grades API is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ created_at: -1 });
    res.json(students || []);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Use POST instead of PUT/DELETE for now to avoid parameter issues
app.post('/api/students/update', async (req, res) => {
  try {
    const { id, student_name, total_marks, marks_obtained } = req.body;
    const percentage = (marks_obtained / total_marks) * 100;

    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      {
        student_name,
        total_marks,
        marks_obtained,
        percentage: parseFloat(percentage.toFixed(2))
      },
      { new: true }
    );

    if (!updatedStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(updatedStudent);
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

app.post('/api/students/delete', async (req, res) => {
  try {
    const { id } = req.body;
    const deletedStudent = await Student.findByIdAndDelete(id);
    if (!deletedStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

app.listen(PORT, () => {
  console.log(`Minimal server running on port ${PORT}`);
});