import { autobind } from 'core-decorators';
import getModels from './models';
import Expo from 'exponent-server-sdk';

export default (ctx) => {
  return class NotificationModule {

    async init() {
      this.models = getModels(ctx);
      this.config = ctx.config.rating;
      this.expo = new Expo();
    }
    async run() {
      this.ws = ctx.app.ws('/api/module/notification')
        .on('connection', this.onSocket);
      ctx.app.use('/api/module/notification', this.getApi());

      // const tokens = [
      //   'ExponentPushToken[rDP4qaKsQi8jy_wV90lk_h]',
      //   'ExponentPushToken[LgGcorMcbyL-oM8BwbhZaP]',
      // ]
      //
      //
      // tokens.forEach(token => this.sendPushNotification(token))
    }


    async sendPushNotification(token, params = {}) {
      // console.log('sendPushNotification', token);
      let tokens;
      if (Array.isArray(token)) {
        tokens = token;
      } else {
        tokens = [token];
      }

      // console.log('sendPushNotification', data);

      const packs = tokens.map(to => ({
        sound: 'default',
        body: 'Вам пришло новое сообщение',
        badge: 99,
        // data: { qwe: 123123 },
        ...params,
        to,
      }));

      return this.expo.sendPushNotificationsAsync(packs);
    }

    async notify(params) {
      // console.log('notify', params);
      const { User } = ctx.models;
      const { Notification } = this.models;
      let notification = new Notification(params);
      await notification.save();
      if (params.userId) {
        const room = this.getRoomName(params.userId);
        notification = await this.populate(notification);
        this.emit({ room, data: notification });

        if (ctx.config.notification) {
          const user = await User.findById(params.userId);
          // console.log({ user, params });
          if (user.private && user.private.pushTokens && user.private.pushTokens.length) {
            const data = {
              data: params,
            }
            if (params.message) {
              data.body = params.message;
            }
            this.sendPushNotification(user.private.pushTokens, data);
          }
        }
      }
      return notification;
    }

    getRoomName(userId) {
      return `user_${userId}`;
    }

    emit({ room, data, action = 'notification' }) {
      return this.ws.to(room).emit(action, data);
    }

    @autobind
    onSocket(socket) {
      const { req } = socket;
      // console.log('Connected!', req.user._id);
      if (!req.user || !req.user._id) throw new Error('Not Auth');
      const roomName = this.getRoomName(req.user._id);
      socket.join(roomName);
    }

    @autobind
    async populate(notification) {
      const { Notification } = this.models;
      try {
        await Notification.populate(notification, {
          path: 'object',
          model: notification.objectType,
        });
      } catch (err) {}
      try {
        await Notification.populate(notification, {
          path: 'subject',
          model: notification.subjectType,
        });
      } catch (err) {}
      return notification;
    }

    getApi() {
      const api = ctx.asyncRouter();
      const { isAuth } = ctx.middlewares;
      const { Notification } = this.models;
      // Поиск
      api.post('/addPushToken', isAuth, async (req) => {
        // console.log('/addPushToken', req.data.pushToken);
        const { pushToken } = req.data;
        if (!pushToken) throw '!pushToken';
        const { User } = ctx.models;
        const userId = req.user._id;
        const user = await User.findById(userId);
        if (user.private) {
          user.private = {};
        }

        const pushTokens = user.private.pushTokens || [];

        if (pushTokens.indexOf(pushToken) === -1) {
          pushTokens.push(pushToken);
        }
        user.private = {
          ...user.private,
          pushTokens,
        };
        return user.save();
      });
      api.get('/', isAuth, async (req) => {
        const userId = req.user._id;
        const params = req.allParams();
        const notifications = await Notification.find({
          userId,
          ...params,
        });
        return await Promise.each(notifications, this.populate);
      });
      api.post('/', isAuth, async (req) => {
        const params = req.allParams();
        return this.notify(params);
      });
      api.post('/view/:id', isAuth, async (req) => {
        // const userId = req.user._id;
        const notification = await Notification
        .findById(req.params.id)
        .then(ctx.helpers.checkNotFound);
        if (notification.viewedAt) return notification;
        notification.viewedAt = new Date();
        return notification.save();
      });
      api.put('/:id', isAuth, async (req) => {
        const params = req.allParams();
        const comment = await Notification
        .findById(params.id)
        .then(ctx.helpers.checkNotFound);
        Object.assign(comment, params);
        return comment.save();
      });
      api.delete('/:id', isAuth, async (req) => {
        const params = req.allParams();
        const notification = await Notification
        .findById(params.id)
        .then(ctx.helpers.checkNotFound);
        return notification.remove();
      });
      return api;
    }
  };
};
