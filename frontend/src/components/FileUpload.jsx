import { useState } from 'react'
import { FaUpload, FaFileExcel, FaCheck, FaExclamationTriangle } from 'react-icons/fa'

const FileUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ]
      
      if (validTypes.includes(selectedFile.type)) {
        setFile(selectedFile)
        setMessage('')
      } else {
        setMessage('Please select a valid Excel (.xlsx) or CSV file')
        setMessageType('error')
        setFile(null)
      }
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first')
      setMessageType('error')
      return
    }

    setUploading(true)
    setMessage('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`Successfully uploaded ${data.studentsCount} student records`)
        setMessageType('success')
        setFile(null)
        document.getElementById('fileInput').value = ''
        onUploadSuccess()
      } else {
        setMessage(data.error || 'Upload failed')
        setMessageType('error')
      }
    } catch (error) {
      setMessage('Error uploading file: ' + error.message)
      setMessageType('error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="text-center mb-6">
        <FaFileExcel className="mx-auto text-5xl text-green-600 mb-3" />
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Upload Student Grades</h2>
        <p className="text-gray-600">
          Upload Excel (.xlsx) or CSV files with student grade data
        </p>
      </div>

      <div className="mb-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
          <input
            id="fileInput"
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="fileInput"
            className="cursor-pointer flex flex-col items-center"
          >
            <FaUpload className="text-3xl text-gray-400 mb-3" />
            <span className="text-lg text-gray-600 mb-2">
              Choose Excel or CSV file
            </span>
            <span className="text-sm text-gray-400">
              Required columns: Student_ID, Student_Name, Total_Marks, Marks_Obtained
            </span>
          </label>
        </div>
      </div>

      {file && (
        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>Selected file:</strong> {file.name}
          </p>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
          !file || uploading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Uploading...
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <FaUpload className="mr-2" />
            Upload File
          </div>
        )}
      </button>

      {message && (
        <div
          className={`mt-4 p-3 rounded-md flex items-center ${
            messageType === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {messageType === 'success' ? (
            <FaCheck className="mr-2" />
          ) : (
            <FaExclamationTriangle className="mr-2" />
          )}
          {message}
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h3 className="font-medium text-gray-800 mb-2">Expected File Format:</h3>
        <div className="text-sm text-gray-600">
          <div className="grid grid-cols-4 gap-2 font-mono bg-white p-2 rounded border">
            <div className="font-semibold">Student_ID</div>
            <div className="font-semibold">Student_Name</div>
            <div className="font-semibold">Total_Marks</div>
            <div className="font-semibold">Marks_Obtained</div>
            <div>S501</div>
            <div>Quinn Flores</div>
            <div>100</div>
            <div>100</div>
            <div>S502</div>
            <div>Morgan Nguyen</div>
            <div>100</div>
            <div>52</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FileUpload