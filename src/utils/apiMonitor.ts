/**
 * API Call Monitoring Utility
 * Tracks and logs API calls to help optimize usage
 */

interface ApiCall {
  endpoint: string;
  timestamp: number;
  method: string;
  source: string; // Component/function that made the call
}

class ApiMonitor {
  private calls: ApiCall[] = [];
  private readonly MAX_STORED_CALLS = 1000;
  
  /**
   * Log an API call
   */
  logCall(endpoint: string, method: string = 'POST', source: string = 'unknown') {
    this.calls.push({
      endpoint,
      method,
      timestamp: Date.now(),
      source
    });
    
    // Keep only recent calls to prevent memory issues
    if (this.calls.length > this.MAX_STORED_CALLS) {
      this.calls = this.calls.slice(-this.MAX_STORED_CALLS);
    }
    
    console.log(`📊 API Call: ${method} ${endpoint} from ${source}`);
  }
  
  /**
   * Get call statistics for the last N minutes
   */
  getStats(minutesBack: number = 60) {
    const cutoff = Date.now() - (minutesBack * 60 * 1000);
    const recentCalls = this.calls.filter(call => call.timestamp > cutoff);
    
    const stats = {
      totalCalls: recentCalls.length,
      callsPerMinute: recentCalls.length / minutesBack,
      byEndpoint: {} as Record<string, number>,
      bySource: {} as Record<string, number>,
      timeRange: `Last ${minutesBack} minutes`
    };
    
    recentCalls.forEach(call => {
      stats.byEndpoint[call.endpoint] = (stats.byEndpoint[call.endpoint] || 0) + 1;
      stats.bySource[call.source] = (stats.bySource[call.source] || 0) + 1;
    });
    
    return stats;
  }
  
  /**
   * Get detailed call history
   */
  getCallHistory(minutesBack: number = 10) {
    const cutoff = Date.now() - (minutesBack * 60 * 1000);
    return this.calls
      .filter(call => call.timestamp > cutoff)
      .map(call => ({
        ...call,
        timeAgo: Math.round((Date.now() - call.timestamp) / 1000) + 's ago'
      }));
  }
  
  /**
   * Print stats to console
   */
  printStats(minutesBack: number = 60) {
    const stats = this.getStats(minutesBack);
    
    console.group(`📊 API Usage Stats - ${stats.timeRange}`);
    console.log(`Total Calls: ${stats.totalCalls}`);
    console.log(`Calls/Minute: ${stats.callsPerMinute.toFixed(1)}`);
    
    console.group('📈 By Endpoint:');
    Object.entries(stats.byEndpoint)
      .sort(([,a], [,b]) => b - a)
      .forEach(([endpoint, count]) => {
        console.log(`${endpoint}: ${count} calls`);
      });
    console.groupEnd();
    
    console.group('🏷️ By Source:');
    Object.entries(stats.bySource)
      .sort(([,a], [,b]) => b - a)
      .forEach(([source, count]) => {
        console.log(`${source}: ${count} calls`);
      });
    console.groupEnd();
    
    console.groupEnd();
  }
  
  /**
   * Clear call history
   */
  clear() {
    this.calls = [];
    console.log('📊 API call history cleared');
  }
}

// Export singleton instance
export const apiMonitor = new ApiMonitor();

// Global functions for debugging
(window as any).apiStats = (minutes?: number) => apiMonitor.printStats(minutes);
(window as any).apiHistory = (minutes?: number) => console.table(apiMonitor.getCallHistory(minutes));
(window as any).clearApiHistory = () => apiMonitor.clear();
