const GeTui = require('./GT.push')
const Target = require('./getui/Target')

const BaseTemplate = require('./getui/template/BaseTemplate')
const TransmissionTemplate = require('./getui/template/TransmissionTemplate')
const LinkTemplate = require('./getui/template/LinkTemplate')
const NotificationTemplate = require('./getui/template/NotificationTemplate')
const NotyPopLoadTemplate = require('./getui/template/NotyPopLoadTemplate')

const AppMessage = require('./getui/message/AppMessage')
const ListMessage = require('./getui/message/ListMessage')
const SingleMessage = require('./getui/message/SingleMessage')

const APNPayload = require('./payload/APNPayload')
const SimpleAlertMsg = require('./payload/SimpleAlertMsg')
const DictionaryAlertMsg = require('./payload/DictionaryAlertMsg')

class PushMessage extends GeTui {
  constructor(options) {
    super(options.HOST, options.APPKEY, options.MASTERSECRET)
    this._options = options
  }

  pushMessage(message, templateType, methodName) {
    switch (typeof message.uidList) {
      case 'string':
        message.uidList = JSON.parse(message.uidList || '[]')
        break
      case 'object':
        message.uidList = message.uidList
        break
      default:
        message.uidList = []
        break
    }

    const pushTargets = this.setTarget(methodName, message)

    console.log("GETUI PUSH MESSAGE UIDS:", pushTargets)

    const messageTemplate = this.setMessageTemplate(message, templateType)
    const messageConfig = this.setMessageConfig(messageTemplate, methodName)

    return this.choosePushFn(methodName, messageConfig, pushTargets)
  }

  setTarget(methodName, message) {
    var uidList = message.uidList
    switch (methodName) {
      case 'pushMessageToApp':
        var targets = uidList.map((uid) => {
          return new Target({ appId: this._options.APPID, alias: uid })
        })
        break;
      case 'pushMessageToList':
          var targets = uidList.map((uid) => {
          return new Target({ appId: this._options.APPID, alias: uid })
        })
        break;
      case 'pushMessageToSingle':
      default:
        var targets = new Target({ appId: this._options.APPID, alias: uidList[0] });
    }
    return targets;
  }

  setMessageTemplate(message = {}, templateType) {
    switch (templateType) {
      case 'transmission':
        return this.composeAPNTransmissionMessage(message)
      case 'notification':
        return new NotificationTemplate(this.composeNotificationMessage(message))
      case 'link':
        return new LinkTemplate(this.composeLinkMessage(message))
      case 'load':
        return new NotyPopLoadTemplate(message)
      case 'base':
        return new BaseTemplate(message)
      default:
        return new BaseTemplate(message)
    }
  }

  setMessageConfig(template, methodName) {
    switch (methodName) {
      case 'pushMessageToApp':
        return new AppMessage({
          isOffline: true,
          offlineExpireTime: 3600 * 12 * 1000,
          data: template,
          appIdList: [this._options.APPID],
          speed: 10000,
        })
      case 'pushMessageToList':
        return new ListMessage({
          isOffline: true,
          offlineExpireTime: 3600 * 12 * 1000,
          data: template
        })
      case 'pushMessageToSingle':
        return new SingleMessage({
          isOffline: true,
          offlineExpireTime: 3600 * 12 * 1000,
          data: template,
          pushNetWorkType: 0
        })
      default:
        return new AppMessage({
          isOffline: true,
          offlineExpireTime: 3600 * 12 * 1000,
          data: template,
          appIdList: [this._options.APPID],
          speed: 10000
        })
    }
  }

  choosePushFn(methodName, ...args) {
    switch (methodName) {
      case 'pushMessageToList': {
        return this.pushMessageToList(...args)
      }
      case 'pushMessageToSingle': {
        return this.pushMessageToSingle(...args)
      }
      case 'pushMessageToApp':
      default: {
        return this.pushMessageToApp(...args)
      }
    }
  }

  pushMessageToApp(messageConfig, pushTargets) {
    return new Promise((resolve, reject) => {
      super.pushMessageToApp(messageConfig, null, (err, res) => {

        console.log("GETUI PUSH MESSAGE TO APP HAVE DONE:", res)

        if (!err && res && 'ok' === res.result) {
          return resolve({ code: 0, message: '推送成功' })
        }

        console.log("GETUI PUSH MESSAGE TO APP HAVE ERR:", err)

        resolve({ code: 100000, message: '推送错误' })
      })
    })
  }

  pushMessageToList(messageConfig, pushTargets) {
    return new Promise((resolve, reject) => {
      super.getContentId(messageConfig, null, (err, res) => {
        console.log("GETUI PUSH MESSAGE TO LIST GET CONTENTID HAVE DONE:", res)
        super.pushMessageToList(res, pushTargets, (err, res) => {
          console.log("GETUI PUSH MESSAGE TO LIST HAVE DONE:", res)
          if (!err && res && 'ok' === res.result) {
            resolve({ code: 0, message: '推送成功' })
          } else {
            console.log("GETUI PUSH MESSAGE TO LIST HAVE ERR:", err)
            resolve({ code: 100000, message: '推送错误' })
          }
        })
      })
    })
  }

  pushMessageToSingle(messageConfig, pushTargets) {
    return new Promise((resolve, reject) => {
      super.pushMessageToSingle(messageConfig, pushTargets, (err, res) => {
        console.log("GETUI PUSH MESSAGE TO SINGLE HAVE DONE:", res)
        if (res && res.result === 'ok') {
          resolve({ code: 0, message: '推送成功' })
        } else if (res && !err) {
          resolve({ code: 1, message: res })
        } else if (err && err.exception && err.exception instanceof RequestError) {
          const requestId = err.exception.requestId
          super.pushMessageToSingle(messageConfig, pushTargets, requestId, (err, res) => {
            if (!err && 'ok' === res.result) {
              resolve({ code: 0, message: '推送成功' })
            }
            resolve({ code: 100000, message: '推送错误' })
          })
        } else {
          resolve({ code: 2, message: 'unknown 错误' })
        }
      })
    })
  }

  composeLinkMessage(message) {
    return {
      appId: this._options.APPID,
      appkey: this._options.APPKEY,
      title: message.title,
      text: message.text,
      logoUrl: message.logoUrl || message.url,
      isRing: true,
      isVibrate: true,
      isClearable: true,
      url: message.url
    }
  }

  composeNotificationMessage(message) {
    return {
      appId: this._options.APPID,
      appkey: this._options.APPKEY,
      title: message.title || '',
      text: message.text || '',
      logo: message.logo || message.url || '',
      isRing: true,
      isVibrate: true,
      isClearable: true,
      transmissionType: message.transmissionType || 1,
      transmissionContent: message.transmissionContent || ''
    }
  }

  composeTransmissionMessage(message) {
    return {
      appId: this._options.APPID,
      appkey: this._options.APPKEY,
      transmissionType: 2,
      transmissionContent: this.formatTransmissioMsg(message)
    }
  }

  composeAPNTransmissionMessage(message) {
    const template = new TransmissionTemplate(this.composeTransmissionMessage(message))
    const payload = new APNPayload()
    const alertMsg = new DictionaryAlertMsg()
    alertMsg.body = message.text
    alertMsg.title = message.title
    alertMsg.alertMsg = 'app推送'
    payload.alertMsg = alertMsg
    payload.badge = 1
    payload.contentAvailable = 1
    payload.category = "ACTIONABLE"
    payload.customMsg.payload1 = this.formatTransmissioMsg(message)
    template.setApnInfo(payload)
    return template
  }

  formatTransmissioMsg(message) {
    const getuiMsgTemlpate = {
      body: {
        text: message.text || 'app推送',
        title: message.title || 'app推送'
      },
      display_type: 'notification',
      extra: {
        jump: message.url || '',
        badge: 1
      }
    }
    return JSON.stringify(getuiMsgTemlpate)
  }

  bindAlias(params) {
    return new Promise((resolve, reject) => {
      super.bindAlias(this._options.APPID, params.uid || params.CID, params.CID, (err, res) => {
        console.log(err, res, res.result)

        if (!err && res && 'ok' === res.result) {
          return resolve({ code: 0, message: '绑定成功' })
        }

        resolve({ code: 100000, message: '推送错误' })
      })
    })
  }

}

module.exports = (options) => {
  return new PushMessage(options)
}