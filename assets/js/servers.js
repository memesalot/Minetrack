import ApexCharts from 'apexcharts'

import { formatNumber, formatTimestampSeconds, formatDate, formatMinecraftServerAddress, formatMinecraftVersions, escapeHtml } from './util'

import MISSING_FAVICON from 'url:../images/missing_favicon.svg'

export class ServerRegistry {
  constructor (app) {
    this._app = app
    this._serverIdsByName = []
    this._serverDataById = []
    this._registeredServers = []
  }

  assignServers (servers) {
    for (let i = 0; i < servers.length; i++) {
      const data = servers[i]
      this._serverIdsByName[data.name] = i
      this._serverDataById[i] = data
    }
  }

  createServerRegistration (serverId) {
    const serverData = this._serverDataById[serverId]
    const serverRegistration = new ServerRegistration(this._app, serverId, serverData)
    this._registeredServers[serverId] = serverRegistration
    return serverRegistration
  }

  getServerRegistration (serverKey) {
    if (typeof serverKey === 'string') {
      const serverId = this._serverIdsByName[serverKey]
      return this._registeredServers[serverId]
    } else if (typeof serverKey === 'number') {
      return this._registeredServers[serverKey]
    }
  }

  getServerRegistrations = () => Object.values(this._registeredServers)

  reset () {
    this._serverIdsByName = []
    this._serverDataById = []
    this._registeredServers = []
    document.getElementById('server-list').innerHTML = ''
  }
}

export class ServerRegistration {
  playerCount = 0
  isVisible = true
  isFavorite = false
  rankIndex
  lastRecordData
  lastPeakData

  constructor (app, serverId, data) {
    this._app = app
    this.serverId = serverId
    this.data = data
    this._graphData = [[], []]
    this._failedSequentialPings = 0
  }

  getGraphDataIndex () {
    return this.serverId + 1
  }

  addGraphPoints (points, timestampPoints) {
    this._graphData = [
      timestampPoints.slice(),
      points
    ]
  }

  buildPlotInstance () {
    const color = this.data.color || '#E9E581'
    const seriesData = this._graphData[0].map((ts, i) => ({
      x: ts * 1000,
      y: this._graphData[1][i] ?? null
    }))

    const options = {
      series: [{
        name: 'Players',
        data: seriesData
      }],
      chart: {
        type: 'area',
        height: 100,
        sparkline: {
          enabled: true
        },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 300
        },
        background: 'transparent'
      },
      colors: [color],
      stroke: {
        curve: 'smooth',
        width: 2
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.5,
          opacityTo: 0.05,
          stops: [0, 90, 100]
        }
      },
      tooltip: {
        enabled: true,
        theme: 'dark',
        x: {
          format: 'h:mm TT'
        },
        y: {
          formatter: (val) => val !== null ? `${formatNumber(val)} players` : 'N/A'
        }
      },
      xaxis: {
        type: 'datetime'
      },
      yaxis: {
        min: (min) => Math.max(0, min - 5),
        max: (max) => max + 5
      }
    }

    const container = document.getElementById(`chart_${this.serverId}`)
    container.innerHTML = ''

    this._chartInstance = new ApexCharts(container, options)
    this._chartInstance.render()
  }

  handlePing (payload, timestamp) {
    if (typeof payload.playerCount === 'number') {
      this.playerCount = payload.playerCount
      this._failedSequentialPings = 0
    } else {
      if (++this._failedSequentialPings > 5) {
        this.playerCount = 0
      }
    }

    this._graphData[0].push(timestamp)
    this._graphData[1].push(payload.playerCount)

    for (const series of this._graphData) {
      if (series.length > this._app.publicConfig.serverGraphMaxLength) {
        series.shift()
      }
    }

    if (this._chartInstance) {
      const seriesData = this._graphData[0].map((ts, i) => ({
        x: ts * 1000,
        y: this._graphData[1][i] ?? null
      }))
      this._chartInstance.updateSeries([{ data: seriesData }])
    }
  }

  updateServerRankIndex (rankIndex) {
    this.rankIndex = rankIndex
    document.getElementById(`ranking_${this.serverId}`).innerText = `#${rankIndex + 1}`
  }

  _renderValue (prefix, handler) {
    const labelElement = document.getElementById(`${prefix}_${this.serverId}`)
    labelElement.style.display = 'block'

    const valueElement = document.getElementById(`${prefix}-value_${this.serverId}`)
    const targetElement = valueElement || labelElement

    if (targetElement) {
      if (typeof handler === 'function') {
        handler(targetElement)
      } else {
        targetElement.innerText = handler
      }
    }
  }

  _hideValue (prefix) {
    const element = document.getElementById(`${prefix}_${this.serverId}`)
    element.style.display = 'none'
  }

  updateServerStatus (ping, minecraftVersions) {
    if (ping.versions) {
      this._renderValue('version', formatMinecraftVersions(ping.versions, minecraftVersions[this.data.type]) || '')
    }

    if (ping.recordData) {
      this._renderValue('record', (element) => {
        if (ping.recordData.timestamp > 0) {
          element.innerText = `${formatNumber(ping.recordData.playerCount)} (${formatDate(ping.recordData.timestamp)})`
          element.title = `At ${formatDate(ping.recordData.timestamp)} ${formatTimestampSeconds(ping.recordData.timestamp)}`
        } else {
          element.innerText = formatNumber(ping.recordData.playerCount)
        }
      })
      this.lastRecordData = ping.recordData
    }

    if (ping.graphPeakData) {
      this._renderValue('peak', (element) => {
        element.innerText = formatNumber(ping.graphPeakData.playerCount)
        element.title = `At ${formatTimestampSeconds(ping.graphPeakData.timestamp)}`
      })
      this.lastPeakData = ping.graphPeakData
    }

    if (ping.error) {
      this._hideValue('player-count')
      this._renderValue('error', ping.error.message)
    } else if (typeof ping.playerCount !== 'number') {
      this._hideValue('player-count')
      this._renderValue('error', 'Failed to ping')
    } else if (typeof ping.playerCount === 'number') {
      this._hideValue('error')
      this._renderValue('player-count', formatNumber(ping.playerCount))
    }

    if (ping.favicon) {
      const faviconElement = document.getElementById(`favicon_${this.serverId}`)
      if (faviconElement.getAttribute('src') !== ping.favicon) {
        faviconElement.setAttribute('src', ping.favicon)
      }
    }
  }

  initServerStatus (latestPing) {
    const serverElement = document.createElement('div')

    const safeName = escapeHtml(this.data.name)
    const safeAddress = escapeHtml(formatMinecraftServerAddress(this.data.ip, this.data.port))

    serverElement.id = `container_${this.serverId}`
    serverElement.innerHTML = `<div class="column column-favicon">
        <img class="server-favicon" src="${latestPing.favicon || MISSING_FAVICON}" id="favicon_${this.serverId}" title="${safeName}\n${safeAddress}">
        <span class="server-rank" id="ranking_${this.serverId}"></span>
      </div>
      <div class="column column-status">
        <h3 class="server-name"><span class="${this._app.favoritesManager.getIconClass(this.isFavorite)}" id="favorite-toggle_${this.serverId}"></span> ${safeName}</h3>
        <span class="server-error" id="error_${this.serverId}"></span>
        <span class="server-label" id="player-count_${this.serverId}">Players: <span class="server-value" id="player-count-value_${this.serverId}"></span></span>
        <span class="server-label" id="peak_${this.serverId}">${this._app.publicConfig.graphDurationLabel} Peak: <span class="server-value" id="peak-value_${this.serverId}">-</span></span>
        <span class="server-label" id="record_${this.serverId}">Record: <span class="server-value" id="record-value_${this.serverId}">-</span></span>
        <span class="server-label" id="version_${this.serverId}"></span>
      </div>
      <div class="column column-graph" id="chart_${this.serverId}"></div>`

    serverElement.setAttribute('class', 'server')
    document.getElementById('server-list').appendChild(serverElement)
  }

  updateHighlightedValue (selectedCategory) {
    ['player-count', 'peak', 'record'].forEach((category) => {
      const labelElement = document.getElementById(`${category}_${this.serverId}`)
      const valueElement = document.getElementById(`${category}-value_${this.serverId}`)

      if (selectedCategory && category === selectedCategory) {
        labelElement.setAttribute('class', 'server-highlighted-label')
        valueElement.setAttribute('class', 'server-highlighted-value')
      } else {
        labelElement.setAttribute('class', 'server-label')
        valueElement.setAttribute('class', 'server-value')
      }
    })
  }

  initEventListeners () {
    document.getElementById(`favorite-toggle_${this.serverId}`).addEventListener('click', () => {
      this._app.favoritesManager.handleFavoriteButtonClick(this)
    }, false)
  }
}
