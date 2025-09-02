import { useState, useEffect } from 'react'
import FileUpload from './components/FileUpload'
import StudentList from './components/StudentList'
import UploadHistory from './components/UploadHistory'
import EditModal from './components/EditModal'
import { FaGraduationCap } from 'react-icons/fa'

function App() {
  const [students, setStudents] = useState([])
  const [uploadHistory, setUploadHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingStudent, setEditingStudent] = useState(null)
  const [activeTab, setActiveTab] = useState('students')

  useEffect(() => {
    fetchStudents()
    fetchUploadHistory()
  }, [])

  const fetchStudents = async () => {
    try {
      const response = await fetch('/api/students')
      const data = await response.json()
      setStudents(data)
    } catch (error) {
      console.error('Error fetching students:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUploadHistory = async () => {
    try {
      const response = await fetch('/api/upload-history')
      const data = await response.json()
      setUploadHistory(data)
    } catch (error) {
      console.error('Error fetching upload history:', error)
    }
  }

  const handleUploadSuccess = () => {
    fetchStudents()
    fetchUploadHistory()
  }

  const handleEditStudent = (student) => {
    setEditingStudent(student)
  }

  const handleUpdateStudent = async (updatedStudent) => {
    try {
      const response = await fetch(`/api/students/${updatedStudent._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedStudent),
      })

      if (response.ok) {
        fetchStudents()
        setEditingStudent(null)
      }
    } catch (error) {
      console.error('Error updating student:', error)
    }
  }

  const handleDeleteStudent = async (studentId) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        const response = await fetch(`/api/students/${studentId}`, {
          method: 'DELETE',
        })

        if (response.ok) {
          fetchStudents()
        }
      } catch (error) {
        console.error('Error deleting student:', error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-4">
            <FaGraduationCap className="text-4xl text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-800">Student Grades Manager</h1>
          </div>
          <p className="text-gray-600">Upload Excel files to manage student grades efficiently</p>
        </div>

        {/* File Upload */}
        <div className="mb-8">
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </div>

        {/* Tab Navigation */}
        <div className="flex mb-6 bg-white rounded-lg shadow-sm p-1">
          <button
            onClick={() => setActiveTab('students')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'students'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Students ({students.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Upload History
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        ) : (
          <>
            {activeTab === 'students' && (
              <StudentList
                students={students}
                onEdit={handleEditStudent}
                onDelete={handleDeleteStudent}
              />
            )}
            {activeTab === 'history' && (
              <UploadHistory history={uploadHistory} />
            )}
          </>
        )}

        {/* Edit Modal */}
        {editingStudent && (
          <EditModal
            student={editingStudent}
            onUpdate={handleUpdateStudent}
            onClose={() => setEditingStudent(null)}
          />
        )}
      </div>
    </div>
  )
}

export default App