# ChatRoom
Sample chat room service prototype using node, socket.io, and redis.

## Server API
logon
`{
	userId: string
}`

createSession
`{
  sessionId: string
}`

joinSession
`{
  sessionId: string
}`

addMessage
`{
  newMessage: string
}`

## Client API
connected
`{
  success: boolean
}`

newMessagesReceived
`{
  messages: [ {
    message: string,
    time: date
  } ]
}`
