import React, { createContext, useContext, useState } from 'react'

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

  const toggleView = () => {
    setIsMobileView(prev => !prev)
  }

  return (
    <ResponsiveContext.Provider value={{ isMobileView, setIsMobileView, toggleView }}>
      {children}
    </ResponsiveContext.Provider>
  )
}
