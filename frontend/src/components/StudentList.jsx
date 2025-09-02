import { FaEdit, FaTrash, FaUser } from 'react-icons/fa'

const   StudentList = ({ students, onEdit, onDelete }) => {
  const getGradeColor = (percentage) => {
    if (percentage >= 90) return 'text-green-600 bg-green-100'
    if (percentage >= 80) return 'text-blue-600 bg-blue-100'
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100'
    if (percentage >= 60) return 'text-orange-600 bg-orange-100'
    return 'text-red-600 bg-red-100'
  }

  const getGrade = (percentage) => {
    if (percentage >= 90) return 'A+'
    if (percentage >= 80) return 'A'
    if (percentage >= 70) return 'B'
    if (percentage >= 60) return 'C'
    return 'F'
  }

  if (students.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <FaUser className="mx-auto text-5xl text-gray-300 mb-4" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">No Students Found</h3>
        <p className="text-gray-500">Upload an Excel file to see student records here</p>
      </div>
    )
  }


  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">
          Student Records ({students.length} students)
        </h2>
      </div>

      {/* Mobile View */}
      <div className="md:hidden">
        {students.map((student) => (
          <div key={student._id} className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg text-gray-800">
                  {student.student_name}
                </h3>
                <p className="text-sm text-gray-600">ID: {student.student_id}</p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => onEdit(student)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => onDelete(student._id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Marks:</span>
                <span className="ml-2 font-medium">{student.total_marks}</span>
              </div>
              <div>
                <span className="text-gray-600">Obtained:</span>
                <span className="ml-2 font-medium">{student.marks_obtained}</span>
              </div>
            </div>
            
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getGradeColor(
                    student.percentage
                  )}`}
                >
                  {student.percentage}%
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor(
                    student.percentage
                  )}`}
                >
                  {getGrade(student.percentage)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Marks
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Marks Obtained
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Percentage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Grade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {students.map((student) => (
              <tr key={student._id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {student.student_name}
                    </div>
                    <div className="text-sm text-gray-500">{student.student_id}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {student.total_marks}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {student.marks_obtained}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getGradeColor(
                      student.percentage
                    )}`}
                  >
                    {student.percentage}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded ${getGradeColor(
                      student.percentage
                    )}`}
                  >
                    {getGrade(student.percentage)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => onEdit(student)}
                      className="text-blue-600 hover:text-blue-900 transition-colors p-1"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => onDelete(student._id)}
                      className="text-red-600 hover:text-red-900 transition-colors p-1"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>Total Students: <strong>{students.length}</strong></span>
          <span>
            Average: <strong>
              {(students.reduce((sum, s) => sum + s.percentage, 0) / students.length).toFixed(1)}%
            </strong>
          </span>
          <span>
            Pass Rate: <strong>
              {((students.filter(s => s.percentage >= 60).length / students.length) * 100).toFixed(1)}%
            </strong>
          </span>
        </div>
      </div>
    </div>
  )
}
export default StudentList