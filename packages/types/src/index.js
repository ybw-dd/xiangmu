"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationType = exports.GroupRole = exports.FriendStatus = exports.MessageStatus = exports.MessageType = exports.ConversationType = exports.UserStatus = void 0;
var UserStatus;
(function (UserStatus) {
    UserStatus["ONLINE"] = "online";
    UserStatus["OFFLINE"] = "offline";
    UserStatus["AWAY"] = "away";
    UserStatus["BUSY"] = "busy";
})(UserStatus || (exports.UserStatus = UserStatus = {}));
var ConversationType;
(function (ConversationType) {
    ConversationType["PRIVATE"] = "private";
    ConversationType["GROUP"] = "group";
})(ConversationType || (exports.ConversationType = ConversationType = {}));
var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "text";
    MessageType["IMAGE"] = "image";
    MessageType["FILE"] = "file";
    MessageType["AUDIO"] = "audio";
    MessageType["VIDEO"] = "video";
    MessageType["SYSTEM"] = "system";
    MessageType["AI"] = "ai";
})(MessageType || (exports.MessageType = MessageType = {}));
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["SENDING"] = "sending";
    MessageStatus["SENT"] = "sent";
    MessageStatus["DELIVERED"] = "delivered";
    MessageStatus["READ"] = "read";
    MessageStatus["FAILED"] = "failed";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
var FriendStatus;
(function (FriendStatus) {
    FriendStatus["PENDING"] = "pending";
    FriendStatus["ACCEPTED"] = "accepted";
    FriendStatus["REJECTED"] = "rejected";
    FriendStatus["BLOCKED"] = "blocked";
})(FriendStatus || (exports.FriendStatus = FriendStatus = {}));
var GroupRole;
(function (GroupRole) {
    GroupRole["OWNER"] = "owner";
    GroupRole["ADMIN"] = "admin";
    GroupRole["MEMBER"] = "member";
})(GroupRole || (exports.GroupRole = GroupRole = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["FRIEND_REQUEST"] = "friend_request";
    NotificationType["FRIEND_ACCEPTED"] = "friend_accepted";
    NotificationType["GROUP_INVITE"] = "group_invite";
    NotificationType["GROUP_JOIN"] = "group_join";
    NotificationType["MENTION"] = "mention";
    NotificationType["SYSTEM"] = "system";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
//# sourceMappingURL=index.js.map