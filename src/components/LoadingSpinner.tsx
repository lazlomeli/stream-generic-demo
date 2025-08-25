import React from 'react'
import LoadingIcon from './LoadingIcon'

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center min-h-64">
      <LoadingIcon size={48} />
    </div>
  )
}

export default LoadingSpinner
