const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/student-grades';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

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

// Upload History Schema
const uploadHistorySchema = new mongoose.Schema({
  filename: { type: String, required: true },
  students_count: { type: Number, required: true },
  uploaded_at: { type: Date, default: Date.now }
});

const UploadHistory = mongoose.model('UploadHistory', uploadHistorySchema);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .csv files are allowed!'), false);
    }
  }
});

// Routes

// Upload Excel file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    let students = [];

    if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      // Process Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      students = jsonData.map(row => {
        const percentage = (row.Marks_Obtained / row.Total_Marks) * 100;
        return {
          student_id: row.Student_ID,
          student_name: row.Student_Name,
          total_marks: row.Total_Marks,
          marks_obtained: row.Marks_Obtained,
          percentage: parseFloat(percentage.toFixed(2))
        };
      });
    } else if (req.file.mimetype === 'text/csv') {
      // Process CSV file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      students = jsonData.map(row => {
        const percentage = (row.Marks_Obtained / row.Total_Marks) * 100;
        return {
          student_id: row.Student_ID,
          student_name: row.Student_Name,
          total_marks: row.Total_Marks,
          marks_obtained: row.Marks_Obtained,
          percentage: parseFloat(percentage.toFixed(2))
        };
      });
    }

    // Save students to database (replace existing data)
    await Student.deleteMany({});
    await Student.insertMany(students);

    // Save upload history
    const uploadRecord = new UploadHistory({
      filename: req.file.originalname,
      students_count: students.length
    });
    await uploadRecord.save();

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ 
      message: 'File uploaded and processed successfully',
      studentsCount: students.length 
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process file: ' + error.message });
  }
});

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ created_at: -1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Update student
app.put('/api/students/:id', async (req, res) => {
  try {
    const { student_name, total_marks, marks_obtained } = req.body;
    const percentage = (marks_obtained / total_marks) * 100;

    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
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
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const deletedStudent = await Student.findByIdAndDelete(req.params.id);
    if (!deletedStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Get upload history
app.get('/api/upload-history', async (req, res) => {
  try {
    const history = await UploadHistory.find().sort({ uploaded_at: -1 }).limit(10);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch upload history' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});