import { useEffect, useState } from 'react'
import { FaHistory, FaFileExcel, FaCalendarAlt } from 'react-icons/fa'

const UploadHistory = () => {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch('/api/upload-history')
        if (!res.ok) throw new Error('Failed to fetch history')
        const data = await res.json()
        if (Array.isArray(data)) {
          setHistory(data)
        } else {
          setHistory([])
        }
      } catch (err) {
        console.error('Error fetching upload history:', err)
        setHistory([])
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <p className="text-gray-500">Loading upload history...</p>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <FaHistory className="mx-auto text-5xl text-gray-300 mb-4" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">No Upload History</h3>
        <p className="text-gray-500">Upload files will appear here once you start uploading</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <FaHistory className="mr-2" />
          Upload History ({history.length} uploads)
        </h2>
      </div>

      {/* Mobile View */}
      <div className="md:hidden">
        {history.map((upload) => (
          <div key={upload._id} className="p-4 border-b border-gray-200 last:border-b-0">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <FaFileExcel className="text-green-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {upload.filename}
                </p>
                <div className="mt-1 text-sm text-gray-500 space-y-1">
                  <div className="flex items-center">
                    <span className="font-medium">{upload.students_count}</span>
                    <span className="ml-1">students processed</span>
                  </div>
                  <div className="flex items-center">
                    <FaCalendarAlt className="mr-1" />
                    {formatDate(upload.uploaded_at)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop View */}
      <div className="hidden md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                File Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Students Count
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Upload Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {history.map((upload) => (
              <tr key={upload._id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <FaFileExcel className="text-green-600 text-sm" />
                      </div>
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">
                        {upload.filename}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900">
                      {upload.students_count}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">students</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <FaCalendarAlt className="mr-2" />
                    {formatDate(upload.uploaded_at)}
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
          <span>
            Total Uploads: <strong>{history.length}</strong>
          </span>
          <span>
            Total Students Processed: <strong>
              {history.reduce((sum, upload) => sum + upload.students_count, 0)}
            </strong>
          </span>
          {history.length > 0 && (
            <span>
              Last Upload: <strong>
                {formatDate(history[0].uploaded_at)}
              </strong>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default UploadHistory
