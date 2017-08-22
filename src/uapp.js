// __DEV__ && console.log('QWEQWEQWE');
export default (ctx) => {
  // __DEV__ && console.log('QWEQWEQWE');
  return {
    init() {
      // __DEV__ && console.log('init@@');
      this.components = require('./components').default(ctx);
      this.stores = require('./mobx').default(ctx);
    },
    async run() {
      // __DEV__ && console.log('run@@');
      this.notificationStore = await this.stores.NotificationStore.getNotificationStore();
      if (__CLIENT__) {
        // __DEV__ && console.log('pre init@@');
        this.notificationStore.init();
      }
      //
      // if (relogin) LOGIC HERE
      // this.notificationStore.reinit()
    },
  };
};
