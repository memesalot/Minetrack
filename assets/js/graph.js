import ApexCharts from 'apexcharts'

import { formatNumber } from './util'
import { FAVORITE_SERVERS_STORAGE_KEY } from './favorites'

const HIDDEN_SERVERS_STORAGE_KEY = 'minetrack_hidden_servers'
const SHOW_FAVORITES_STORAGE_KEY = 'minetrack_show_favorites'

export class GraphDisplayManager {
  constructor (app) {
    this._app = app
    this._graphData = []
    this._graphTimestamps = []
    this._hasLoadedSettings = false
    this._initEventListenersOnce = false
    this._showOnlyFavorites = false
  }

  addGraphPoint (timestamp, playerCounts) {
    if (!this._hasLoadedSettings) {
      return
    }

    this._graphTimestamps.push(timestamp * 1000)

    for (let i = 0; i < playerCounts.length; i++) {
      this._graphData[i].push(playerCounts[i])
    }

    const graphMaxLength = this._app.publicConfig.graphMaxLength

    if (this._graphTimestamps.length > graphMaxLength) {
      this._graphTimestamps.splice(0, this._graphTimestamps.length - graphMaxLength)
    }

    for (const series of this._graphData) {
      if (series.length > graphMaxLength) {
        series.splice(0, series.length - graphMaxLength)
      }
    }

    this._chartInstance.updateSeries(this._buildSeriesData())
  }

  loadLocalStorage () {
    if (typeof localStorage !== 'undefined') {
      const showOnlyFavorites = localStorage.getItem(SHOW_FAVORITES_STORAGE_KEY)
      if (showOnlyFavorites) {
        this._showOnlyFavorites = true
      }

      let raw
      if (this._showOnlyFavorites) {
        raw = localStorage.getItem(FAVORITE_SERVERS_STORAGE_KEY)
      } else {
        raw = localStorage.getItem(HIDDEN_SERVERS_STORAGE_KEY)
      }

      if (raw) {
        let serverNames
        try {
          serverNames = JSON.parse(raw)
        } catch (e) {
          return
        }

        if (!Array.isArray(serverNames)) {
          return
        }

        for (const serverRegistration of this._app.serverRegistry.getServerRegistrations()) {
          if (this._showOnlyFavorites) {
            serverRegistration.isVisible = serverNames.indexOf(serverRegistration.data.name) >= 0
          } else {
            serverRegistration.isVisible = serverNames.indexOf(serverRegistration.data.name) < 0
          }
        }
      }
    }
  }

  updateLocalStorage () {
    if (typeof localStorage !== 'undefined') {
      const serverNames = this._app.serverRegistry.getServerRegistrations()
        .filter(serverRegistration => !serverRegistration.isVisible)
        .map(serverRegistration => serverRegistration.data.name)

      if (serverNames.length > 0 && !this._showOnlyFavorites) {
        localStorage.setItem(HIDDEN_SERVERS_STORAGE_KEY, JSON.stringify(serverNames))
      } else {
        localStorage.removeItem(HIDDEN_SERVERS_STORAGE_KEY)
      }

      if (this._showOnlyFavorites) {
        localStorage.setItem(SHOW_FAVORITES_STORAGE_KEY, true)
      } else {
        localStorage.removeItem(SHOW_FAVORITES_STORAGE_KEY)
      }
    }
  }

  getGraphData () {
    return [
      this._graphTimestamps,
      ...this._graphData
    ]
  }

  getGraphDataPoint (serverId, index) {
    const graphData = this._graphData[serverId]
    if (graphData && index < graphData.length && typeof graphData[index] === 'number') {
      return graphData[index]
    }
  }

  _buildSeriesData () {
    return this._app.serverRegistry.getServerRegistrations().map(serverRegistration => {
      const data = this._graphData[serverRegistration.serverId] || []
      return {
        name: serverRegistration.data.name,
        data: this._graphTimestamps.map((ts, i) => ({
          x: ts,
          y: data[i] ?? null
        }))
      }
    })
  }

  buildPlotInstance (timestamps, data) {
    if (!this._hasLoadedSettings) {
      this._hasLoadedSettings = true
      this.loadLocalStorage()
    }

    for (const playerCounts of data) {
      const lengthDiff = timestamps.length - playerCounts.length
      if (lengthDiff > 0) {
        const padding = Array(lengthDiff).fill(null)
        playerCounts.unshift(...padding)
      }
    }

    this._graphTimestamps = timestamps.map(ts => ts * 1000)
    this._graphData = data

    const colors = this._app.serverRegistry.getServerRegistrations().map(sr => sr.data.color || '#9696ff')

    const options = {
      series: this._buildSeriesData(),
      chart: {
        type: 'area',
        height: 400,
        background: 'transparent',
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 300,
          dynamicAnimation: {
            enabled: true,
            speed: 300
          }
        },
        toolbar: {
          show: false
        },
        zoom: {
          enabled: true,
          type: 'x'
        },
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      colors: colors,
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: 'smooth',
        width: 2.5
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 90, 100]
        }
      },
      legend: {
        show: false
      },
      xaxis: {
        type: 'datetime',
        labels: {
          style: {
            colors: '#9ca3af',
            fontSize: '12px'
          },
          datetimeFormatter: {
            hour: 'h:mm TT'
          }
        },
        axisBorder: {
          show: false
        },
        axisTicks: {
          show: false
        }
      },
      yaxis: {
        labels: {
          style: {
            colors: '#9ca3af',
            fontSize: '12px'
          },
          formatter: (val) => formatNumber(Math.round(val))
        }
      },
      grid: {
        borderColor: '#1f2937',
        strokeDashArray: 4,
        xaxis: {
          lines: {
            show: false
          }
        }
      },
      tooltip: {
        enabled: true,
        shared: true,
        intersect: false,
        theme: 'dark',
        style: {
          fontSize: '13px'
        },
        x: {
          format: 'MMM dd, h:mm TT'
        },
        y: {
          formatter: (val) => val !== null ? `${formatNumber(val)} players` : 'N/A'
        }
      }
    }

    const container = document.getElementById('big-graph')
    container.innerHTML = ''

    this._chartInstance = new ApexCharts(container, options)
    this._chartInstance.render()

    document.getElementById('settings-toggle').style.display = 'flex'
  }

  redraw = () => {
    this.updateLocalStorage()

    const visibleServers = this._app.serverRegistry.getServerRegistrations()

    visibleServers.forEach((serverRegistration, index) => {
      if (serverRegistration.isVisible) {
        this._chartInstance.showSeries(serverRegistration.data.name)
      } else {
        this._chartInstance.hideSeries(serverRegistration.data.name)
      }
    })
  }

  requestResize () {
    if (this._chartInstance) {
      if (this._resizeRequestTimeout) {
        clearTimeout(this._resizeRequestTimeout)
      }
      this._resizeRequestTimeout = setTimeout(this.resize, 200)
    }
  }

  resize = () => {
    if (this._chartInstance) {
      this._chartInstance.updateOptions({}, true, false)
    }

    if (this._resizeRequestTimeout) {
      clearTimeout(this._resizeRequestTimeout)
    }
    this._resizeRequestTimeout = undefined
  }

  initEventListeners () {
    if (!this._initEventListenersOnce) {
      this._initEventListenersOnce = true

      document.getElementById('settings-toggle').addEventListener('click', this.handleSettingsToggle, false)

      document.querySelectorAll('.graph-controls-show').forEach((element) => {
        element.addEventListener('click', this.handleShowButtonClick, false)
      })
    }

    document.querySelectorAll('.graph-control').forEach((element) => {
      element.addEventListener('click', this.handleServerButtonClick, false)
    })
  }

  handleServerButtonClick = (event) => {
    const serverId = parseInt(event.target.getAttribute('minetrack-server-id'))
    const serverRegistration = this._app.serverRegistry.getServerRegistration(serverId)

    if (serverRegistration.isVisible !== event.target.checked) {
      serverRegistration.isVisible = event.target.checked
      this._showOnlyFavorites = false
      this.redraw()
    }
  }

  handleShowButtonClick = (event) => {
    const showType = event.target.getAttribute('minetrack-show-type')
    this._showOnlyFavorites = showType === 'favorites'

    let redraw = false

    this._app.serverRegistry.getServerRegistrations().forEach(function (serverRegistration) {
      let isVisible
      if (showType === 'all') {
        isVisible = true
      } else if (showType === 'none') {
        isVisible = false
      } else if (showType === 'favorites') {
        isVisible = serverRegistration.isFavorite
      }

      if (serverRegistration.isVisible !== isVisible) {
        serverRegistration.isVisible = isVisible
        redraw = true
      }
    })

    if (redraw) {
      this.redraw()
      this.updateCheckboxes()
    }
  }

  handleSettingsToggle = () => {
    const element = document.getElementById('big-graph-controls-drawer')

    if (element.style.display !== 'block') {
      element.style.display = 'block'
    } else {
      element.style.display = 'none'
    }
  }

  handleServerIsFavoriteUpdate = (serverRegistration) => {
    if (this._showOnlyFavorites && serverRegistration.isVisible !== serverRegistration.isFavorite) {
      serverRegistration.isVisible = serverRegistration.isFavorite
      this.redraw()
      this.updateCheckboxes()
    }
  }

  updateCheckboxes () {
    document.querySelectorAll('.graph-control').forEach((checkbox) => {
      const serverId = parseInt(checkbox.getAttribute('minetrack-server-id'))
      const serverRegistration = this._app.serverRegistry.getServerRegistration(serverId)
      checkbox.checked = serverRegistration.isVisible
    })
  }

  reset () {
    if (this._chartInstance) {
      this._chartInstance.destroy()
      this._chartInstance = undefined
    }

    this._graphTimestamps = []
    this._graphData = []
    this._hasLoadedSettings = false

    if (this._resizeRequestTimeout) {
      clearTimeout(this._resizeRequestTimeout)
      this._resizeRequestTimeout = undefined
    }

    document.getElementById('big-graph-checkboxes').innerHTML = ''
    document.getElementById('big-graph-controls').style.display = 'none'
    document.getElementById('settings-toggle').style.display = 'none'
  }
}
