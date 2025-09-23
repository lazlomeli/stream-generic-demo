import React, { createContext, useContext, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface ResponsiveContextType {
  isMobileView: boolean
  setIsMobileView: (isMobile: boolean) => void
  toggleView: () => void
}

const ResponsiveContext = createContext<ResponsiveContextType | undefined>(undefined)

export const useResponsive = () => {
  const context = useContext(ResponsiveContext)
  if (context === undefined) {
    throw new Error('useResponsive must be used within a ResponsiveProvider')
  }
  return context
}

interface ResponsiveProviderProps {
  children: React.ReactNode
}

export const ResponsiveProvider: React.FC<ResponsiveProviderProps> = ({ children }) => {
  const [isMobileView, setIsMobileView] = useState(false)
  const location = useLocation()

  const toggleView = () => {
    setIsMobileView(prev => !prev)
  }

  // Auto-switch to desktop view when on /video route
  useEffect(() => {
    if (location.pathname === '/video') {
      setIsMobileView(false)
    }
  }, [location.pathname])

  return (
    <ResponsiveContext.Provider value={{ isMobileView, setIsMobileView, toggleView }}>
      {children}
    </ResponsiveContext.Provider>
  )
}
