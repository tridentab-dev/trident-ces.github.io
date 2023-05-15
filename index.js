
  console.log("Content Test 1.18.0")
  console.log({ myShopify: Shopify.shop })
  if(Shopify.shop === '96818a-2.myshopify.com') {

class InteractMode {
  constructor({ interface_ }) {
    this.modeBase = new ModeBase([ new LinkNavigation({ interface_ }) ])
  }
  enable() {
    this.modeBase.enable()
  }
  disable() {
    this.modeBase.disable()
  }
}


class LinkNavigation {
  constructor({ interface_ }) {
    this.interface_ = interface_
    this.linkHandlers = new Map() // initialize a new Map to store link handlers
    this.navigate = this.handleNavigation.bind(this)
  }

  enable() {
    const links = document.querySelectorAll('a')
    links.forEach(link => {
      const href = link.href
      if (!this.linkHandlers.has(href)) {
        const handler = this.handleNavigation(href)
        this.linkHandlers.set(href, handler)
      }
      link.addEventListener('click', this.linkHandlers.get(href))
    })
  }

  disable() {
    const links = document.querySelectorAll('a')
    links.forEach(link => {
      const href = link.href
      if (this.linkHandlers.has(href)) {
        link.removeEventListener('click', this.linkHandlers.get(href))
        this.linkHandlers.delete(href) // remove the memoized link handler
      }
    })
  }

  handleNavigation(urlPath) {
    return (event) => {
      event.preventDefault()
      const path = new URL(urlPath).pathname
      this.interface_.send({ messageType: MessageTypes.Page.UrlPathChanged, data: { path } })
    }
  }
}


class EditMode {
  constructor({ interface_, domSelector, domStyle }) {
    this.modeBase = new ModeBase([ new EditableStyle(), new ClickInterception({ interface_, domSelector, domStyle }) ])
  }
  enable() {
    this.modeBase.enable()
  }
  disable() {
    this.modeBase.disable()
  }
}

class EditableStyle {
  constructor() {
    this.mouseoverListener = this.handleMouseover.bind(this)
    this.mouseoutListener = this.handleMouseout.bind(this)
    this.sheet = null
  }

  enable() {
    this.sheet = document.createElement('style')
    this.sheet.innerHTML = '.content-editable { border: 1px solid rgb(18, 148, 144); cursor: pointer; }'
    document.body.appendChild(this.sheet)
    window.addEventListener('mouseover', this.mouseoverListener)
    window.addEventListener('mouseout', this.mouseoutListener)
  }

  disable() {
    window.removeEventListener('mouseover', this.mouseoverListener)
    window.removeEventListener('mouseout', this.mouseoutListener)
    if (this.sheet) {
      this.sheet.parentNode.removeChild(this.sheet)
      this.sheet = null
    }
  }

  handleMouseover(event) {
    let elems = document.querySelectorAll('.content-editable');
    [].forEach.call(elems, function(el) {
      el.classList.remove('content-editable')
    })
    event.srcElement.classList.add('content-editable')
  }

  handleMouseout(_event) {
    let elems = document.querySelectorAll('.content-editable');
    [].forEach.call(elems, function(el) {
      el.classList.remove('content-editable')
    })
  }

  removeFrom(element) {
    element.classList.remove('content-editable')
    if (element.classList.length === 0) element.removeAttribute('class')
  }
}


class ClickInterception {
  constructor({ interface_, domSelector, domStyle }) { //To Do
    this.interface_ = interface_
    this.domSelector = domSelector
    this.domStyle = domStyle
    this.onClick = this.onClick.bind(this)
  }

  enable() {
    document.body.addEventListener('click', this.onClick, false)
  }

  disable() {
    document.body.removeEventListener('click', this.onClick, false)
  }

  onClick(event) {
    event.stopPropagation()
    event.preventDefault()
    this.interface_.send({
      messageType: MessageTypes.Page.ElementSelected,
      data: {
        elementChange: new ElementChange({
          selector: this.domSelector.find({ event }),
          initialStyle: this.domStyle.read({ event })
        })
      }
    })
  }
}


class ModeManager {
  constructor({ interface_, domSelector, domStyle }) {
    this.editMode = new EditMode({ interface_, domSelector, domStyle })
    this.interactMode = new InteractMode({ interface_ })
  }
  toggle(mode) {
    console.log('toggle mode')
    this.clear()
    if (mode === Modes.Interact) this.interact()
    if (mode === Modes.Edit) this.edit()
  }

  interact() {
    this.interactMode.enable()
  }

  edit() {
    this.editMode.enable()
  }

  clear() {
    this.editMode.disable()
    this.interactMode.disable()
  }
}

class ModeBase {
  constructor(behaviorList = []) {
    this.behaviorList = behaviorList
  }

  enable() {
    this.behaviorList.forEach(behavior => behavior.enable())
  }

  disable() {
    this.behaviorList.forEach(behavior => behavior.disable())
  }
}

class EditionEnvironment {
  constructor({ interface_, messageMapping }) {
    this.interface_ = interface_
    this.messageMapping = messageMapping
  }
  start() {
    this.interface_.subscribeToMessages({ messageMapping: this.messageMapping })
  }
}

class PageMessageMapping {
  constructor({ elementLiveStyle, contentTestLiveStyle, modeManager }) {
    this.elementLiveStyle = elementLiveStyle
    this.contentTestLiveStyle = contentTestLiveStyle
    this.modeManager = modeManager
  }

  build() {
    const loadContentTest = ({ data }) => {
      this.contentTestLiveStyle.apply(data)
    }

    const changeMode = ({ data }) => {
      console.log({ change: 'mode', data })
      this.modeManager.toggle(data.selectedMode)
    }

    const changeElement = ({ data }) => {
      const { elementChange } = data
      this.elementLiveStyle.apply({ elementChange })
    }

    return {
      [MessageTypes.Editor.EditorOpened]: loadContentTest,
      [MessageTypes.Editor.ModeChanged]: changeMode,
      [MessageTypes.Editor.ElementChanged]: changeElement
    }
  }
}
class EnvironmentFactory {
  constructor({ liveEnv, editionEnv }) {
    this.liveEnv = liveEnv
    this.editionEnv = editionEnv
  }
  create() {
    if (this.isPageInsideIframe()) return this.editionEnv
    return this.liveEnv
  }

  isPageInsideIframe() {
    return window.location !== window.parent.location // To Do: add security/cors
  }
}
class Logger { //refactor
  static log(message) {
    console.log(message)
  }
  static error(message) {
    console.error(message)
  }
}


class DOMStyle {
  read({ event }) {
    const element = event.srcElement
    const computedCssStyle = window.getComputedStyle(element)
    const cssStyle = element.style

    return new Style({
      tagName: element.tagName,
      text: element.innerHTML,
      fontFamily: computedCssStyle.fontFamily,
      fontColor: color(computedCssStyle.color), //To Do: equalize
      fontWeight: computedCssStyle.fontWeight,
      fontSize: computedCssStyle.fontSize,
      marginTop: computedCssStyle.marginTop,
      marginBottom: computedCssStyle.marginBottom,
      marginLeft: computedCssStyle.marginLeft,
      marginRight: computedCssStyle.marginRight,
      backgroundColor: color(cssStyle.backgroundColor),
      display: computedCssStyle.display
    })
  }
  write({ domElement, newStyle, selector }) {
    domElement.innerHTML = text()
    writeStyle('color', newStyle.fontColor, true) //To Do: equalize
    writeStyle('fontWeight', newStyle.fontWeight)
    writeStyle('fontFamily', newStyle.fontFamily)
    writeStyle('fontSize', newStyle.fontSize)
    writeStyle('marginTop', newStyle.marginTop)
    writeStyle('marginBottom', newStyle.marginBottom)
    writeStyle('marginLeft', newStyle.marginLeft)
    writeStyle('marginRight', newStyle.marginRight)
    writeStyle('backgroundColor', newStyle.backgroundColor, true)
    writeStyle('display', newStyle.display)

    return selector

    function text() { //To Do: dependency with quill editor
      if (newStyle.text.substring(0, 3) !== '<p>') return newStyle.text

      return newStyle.text.substring(3, newStyle.text.length - 4)
    }

    function writeStyle(property, value, isColor = false) {
      function currentStyleValue() {
        return window.getComputedStyle(domElement)[property]
      }
      const currentValue = () => {
        return isColor ? color(currentStyleValue()) : currentStyleValue()
      }

      if (currentValue() === value) return
      domElement.style[property] = value
    }
  }
}

function color(styleColor) { //To Do: extract in a common dir
  function colorToHex(color) {
    let hexadecimal = color.toString(16)
    return hexadecimal.length === 1 ? '0' + hexadecimal : hexadecimal
  }

  function rgbColorToHex(rgbList) {
    const [ red, green, blue ] = rgbList.map(number => parseInt(number))
    return '#' + colorToHex(red) + colorToHex(green) + colorToHex(blue)
  }

  return styleColor === '' ? styleColor : rgbColorToHex(styleColor.match(/\d+/g))
}


class DOMSelector {
  constructor( { editableStyle }) {
    this.editableStyle = editableStyle //Refactor dependency
  }
  //To Do consider when multiple changes affect the same element
  find({ event }) {
    this.editableStyle.removeFrom(event.srcElement)
    return new Selector({
      path: path(),
      outerHTML: event.srcElement.outerHTML
    })

    function path() {
      let items = Array
        .from(event.composedPath())
        .filter(rejectIframeParent)
        .map(pathItemSelector)

      const firstIndex = items.map((item, index) => (item.id !== '' ? index : undefined)).filter(item => item !== undefined)[0]
      if (firstIndex !== undefined) items = items.slice(0, firstIndex + 1)

      return items.map(elementToString)
      .reverse()
      .join(' ')
    }

    function elementToString(pathItem) {
      const { tag, id, class_ } = pathItem
      return `${tag}${id}${class_}`
    }

    function rejectIframeParent(pathItem) {
      return pathItem.nodeName !== '#document' && pathItem.name !== 'content_test_editor_iframe'
    }
  }

  select({ selector }) {
    if (selector.isUnique) return document.querySelector(selector.path)

    return document.querySelectorAll(selector.path).item(selector.index)
  }
}

function pathItemSelector(pathItem) {
  return {
    tag: tag(),
    id: id(),
    class_: class_()
  }

  function tag() {
    return pathItem.localName
  }

  function id() {
    if (pathItem.id === '') return ''
    return `#${pathItem.id}`
  }

  function class_() {
    if (!pathItem.classList) return ''
    if (pathItem.classList.value === '') return ''
    return Array.from(pathItem.classList).map(readClass).filter(class_ => !!class_).join('')
  }
}

function readClass(item) {
  return `.${item}`
}


class ElementLiveStyle {
  constructor({ domSelector, domStyle, interface_ }) {
    this.domSelector = domSelector
    this.domStyle = domStyle
    this.interface_ = interface_
  }

  apply({ elementChange: { selector, newStyle } }) {
    const run = (trial = 0) => {
      // const MAX_TRIALS = 1000
      const domElement = this.domSelector.select({ selector })
      if (!domElement) {
        return setTimeout(run, 0)
        // if (trial < MAX_TRIALS)
        // return console.error({ error: 'element not found', selector })
      }

      Logger.log({ info: 'apply style to element', selector })
      return this.domStyle.write({ domElement, newStyle, selector })
    }
    return run()
  }
}

class ContentTestLiveStyle {
  constructor({ elementLiveStyle }) {
    this.elementLiveStyle = elementLiveStyle
  }

  apply({ contentTest, urlPath }) {
    document.body.display='none'
    contentTest.changes.forEach(elementChange => {
      if (urlPath === elementChange.urlPath) {
        this.elementLiveStyle.apply({ elementChange })
      }
    })
    // document.body.display='block'
  }
}

class ClientVersionLocalStorageRepository { //improve key and managemente into local storage
  //Too Do rename storage to repository

  find({ contentTest }) {
    const key = this.key({ contentTest })
    const item = JSON.parse(localStorage.getItem(key))
    if (item && !this.expired(item)) return item
  }

  create({ clientVersion, contentTest }) {
    return this.save({ clientVersion: { ...clientVersion, created_at: new Date() }, contentTest })
  }

  update({ clientVersion, contentTest }) {
    return this.save({ clientVersion: { ...clientVersion, updated_at: new Date() }, contentTest })
  }

  save({ clientVersion, contentTest }) {
    const key = this.key({ contentTest })
    localStorage.setItem(key, JSON.stringify(clientVersion))
    return clientVersion
  }

  key({ contentTest }) {
    return `content_test_${contentTest._id}`
  }

  secondsToExpire() {
    return 60 * 60
  }

  expired(item) {
    const savedAt = new Date(item.savedAt)
    savedAt.setSeconds(savedAt.getSeconds() + this.secondsToExpire())
    return savedAt < new Date()
  }
}
class ClientVersionManager {
  constructor({ repository }) {
    this.repository = repository
  }

  get({ contentTest }) {
    return this.repository.find({ contentTest }) || this.create({ contentTest })
  }

  create({ contentTest }) {
    const clientVersion = this.build()
    return this.repository.create({ contentTest, clientVersion })
  }

  build() {
    return {
      version: Math.random() < 0.5 ? 'a' : 'b'
    }
  }
}
class Metric {

  constructor({ api, clientVersionRepository }) {
    this.api = api
    this.clientVersionRepository = clientVersionRepository
  }

  addView({ contentTest, clientVersion }) {
    this.api.addView({ contentTest, clientVersion })
    this.clientVersionRepository.update({ clientVersion, contentTest })
  }
}
class LiveEnvironment {
  constructor({ api, liveStyle, clientVersionManager, metric }) {
    this.api = api
    this.liveStyle = liveStyle
    this.clientVersionManager = clientVersionManager
    this.metric = metric
  }

  start() {
    const contentTest = this.findContentTest()
    if (!contentTest) return
    const clientVersion = this.getClientVersion({ contentTest })
    this.addView({ contentTest, clientVersion })
    if (this.shouldShowContentTestVersion(clientVersion)) this.applyContentTestStyle(contentTest)
  }

  shouldShowContentTestVersion(clientVersion) {
    return clientVersion.version === 'b'
  }

  applyContentTestStyle(contentTest) {
    this.liveStyle.apply({ contentTest, urlPath: window.location.pathname })
  }

  getClientVersion({ contentTest }) {
    return this.clientVersionManager.get({ contentTest })
  }

  findContentTest() {
    return this.api.findByPage({ page: window.location.pathname })
  }

  addView({ contentTest, clientVersion }) {
    this.metric.addView({ contentTest, clientVersion })
  }
}


class ContentTestAPI {
  findByPage({ page }) {
    // To Do: fix hard-coded URL
    // To Do: use fetch in both
    const url = `https://localhost/api/content_test/?page=${page}`

    return JSON.parse(httpGet(url)).content_test

    function httpGet(theUrl) {
      let xmlHttp = new XMLHttpRequest()
      xmlHttp.open( 'GET', theUrl, false )
      xmlHttp.send( null )
      return xmlHttp.responseText
    }
  }
  addView({ contentTest, clientVersion }) {
    // To Do: fix hard-coded URL
    fetch(`https://localhost/api/content_test/${contentTest._id}/add_view`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientVersion),
    })
    .then((response) => response.json())
    .then((data) => {
      Logger.log('Success on Add View:', data)
    })
    .catch((error) => {
      Logger.error('Error on Add View:', error)
    })
  }
}


class Interface {
  constructor({ otherWindow, myWindow, myRole, messageReader }) {
    this.otherWindow = otherWindow
    this.myWindow = myWindow
    this.myRole = myRole
    this.messageReader = messageReader
  }

  send({ messageType, data }) {
    const message = new Message({ role: this.myRole, messageType, data })
    this.otherWindow.postMessage(message, '*')
  }

  subscribeToMessages({ messageMapping }) {
    const messageReader = this.messageReader({ messageMapping })
    this.myWindow.addEventListener('message', messageReader, false)
  }
}

const Modes = {
  Interact: 'interact',
  Edit: 'edit'
}

function Message({ role, messageType, data }) {
  this.role = role
  this.messageType = messageType
  this.data = data || {}
  this.source = Source.ContentEdition
}

const Source = {
  ContentEdition: 'content-edition'
}

const Role = {
  Page: 'page',
  Editor: 'editor'
}

const MessageTypes = { //To Do fix all these types together
  Page: {
    ElementSelected: 'element-selected',
    ElementSelectorChanged: 'element-selector-changed',
    UrlPathChanged: 'url-changed'
  },
  Editor: {
    EditorOpened: 'editor-opened',
    ModeChanged: 'mode-changed',
    ElementChanged: 'element-changed',
  }
}


function MessageReader({ messageMapping }) {
  return (event) => {
    if (event.data.source !== Source.ContentEdition) return

    const message = event.data
    Logger.log({ message })
    const action = messageMapping[message.messageType]
    action({ data: message.data })
  }
}


class Dependency {
  static buildForPage() {
    const interface_ = new Interface({
      otherWindow: window.parent,
      myWindow: window,
      myRole: Role.Page,
      messageReader: MessageReader
    })

    const domSelector = new DOMSelector({ editableStyle: new EditableStyle() })
    const domStyle = new DOMStyle()

    const elementLiveStyle = new ElementLiveStyle({ domSelector, domStyle, interface_ })
    const contentTestLiveStyle = new ContentTestLiveStyle({ elementLiveStyle })

    const liveEnv = new LiveEnvironment({
      api: new ContentTestAPI(),
      liveStyle: contentTestLiveStyle,
      clientVersionManager: new ClientVersionManager({
        repository: new ClientVersionLocalStorageRepository()
      }),
      metric: new Metric({
        api: new ContentTestAPI(),
        clientVersionRepository: new ClientVersionLocalStorageRepository()
      })
    })

    const editionEnv = new EditionEnvironment({
      interface_,
      messageMapping: new PageMessageMapping({
        modeManager: new ModeManager({ interface_, domSelector, domStyle }),
        elementLiveStyle,
        contentTestLiveStyle,
        interface_
      }).build()
    })

    return {
      environmentFactory: new EnvironmentFactory({ liveEnv, editionEnv })
    }
  }

  static buildForEditor({ iframeWindow }) {
    return {
      interface_: new Interface({
        otherWindow: iframeWindow,
        myWindow: window,
        myRole: Role.Editor,
        messageReader: MessageReader
      })
    }
  }
}

function ElementChange({ selector, initialStyle }) {
  this.initialStyle = new Style(initialStyle)
  this.selector = new Selector(selector)
  this.newStyle = undefined
}

function Selector({ path, outerHTML }) {
  this.path = path
  this.outerHTML = outerHTML
  this.isUnique = isUnique()
  this.index = index()

  function isUnique () {
    return allElementsInPath().length === 1
  }

  function index() {
    if (isUnique()) return 0
    return allElementsInPath().findIndex(element => element.outerHTML === outerHTML)
  }

  function allElementsInPath() {
    return Array.from(document.querySelectorAll(path))
  }
}

function Style({
  tagName,
  text,
  fontFamily,
  fontColor,
  fontWeight,
  fontSize,
  marginTop,
  marginBottom,
  marginLeft,
  marginRight,
  backgroundColor,
  display
}) {
  this.tagName = tagName
  this.text = text
  this.fontFamily = fontFamily
  this.fontColor = fontColor
  this.fontWeight = fontWeight
  this.fontSize = fontSize
  this.marginTop = marginTop
  this.marginBottom = marginBottom
  this.marginLeft = marginLeft
  this.marginRight = marginRight
  this.backgroundColor = backgroundColor
  this.display = display
}


class EditorMessageMapping { //Refactor
  constructor(iframeWindow) {
    const { interface_ } = Dependency.buildForEditor({ iframeWindow })
    this.interface_ = interface_
  }

  build({ onElementSelected, setUrlPath }) {
    this.interface_.subscribeToMessages({
      messageMapping: {
        [MessageTypes.Page.ElementSelected]:({ data }) => onElementSelected({ data }),
        [MessageTypes.Page.UrlPathChanged]: ({ data }) => setUrlPath(data.path)
      }
    })
  }

  send({ messageType, data }) {
    this.interface_.send({ messageType, data })
  }
}
    //new Font().load()
    const { environmentFactory } = Dependency.buildForPage()
    const environment = environmentFactory.create()
    environment.start()
  }
