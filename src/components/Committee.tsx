import * as React from 'react';
import * as firebase from 'firebase';
import { RouteComponentProps } from 'react-router';
import { Route } from 'react-router-dom';
import { MemberData, MemberID } from './Member';
import Caucus, { CaucusData, CaucusID, DEFAULT_CAUCUS, DEFAULT_CAUCUS_TIME_SECONDS } from './Caucus';
import Resolution, { ResolutionData, ResolutionID, DEFAULT_RESOLUTION } from './Resolution';
import Admin from './Admin';
import { Icon, Menu, SemanticICONS, Dropdown, Container, Responsive, Sidebar, Header, Label, Divider, 
  List, Input } from 'semantic-ui-react';
import Stats from './Stats';
import { MotionID, MotionData } from './Motions';
import { TimerData, DEFAULT_TIMER } from './Timer';
import Unmod from './Unmod';
import Notes from './Notes';
import Help, { KEYBOARD_SHORTCUT_LIST } from './Help';
import Motions from './Motions';
import { postCaucus } from '../actions/caucusActions';
import { URLParameters, Dictionary } from '../types';
import Loading from './Loading';
import Footer from './Footer';
import Settings, { SettingsData, DEFAULT_SETTINGS } from './Settings';
import Files, { PostID, PostData } from './Files';
import { ModalLogin } from './Auth';
import ShareHint from './ShareHint';
import Notifications from './Notifications';
import { postResolution } from '../actions/resolutionActions';
import ConnectionStatus from './ConnectionStatus';
import { fieldHandler } from 'src/actions/handlers';
import { membersToOptions } from 'src/utils';
import { MemberOption } from 'src/constants';

export function recoverMemberOptions(committee?: CommitteeData): MemberOption[] {
  if (committee) {
    return membersToOptions(committee.members);
  } else {
    return [];
  }
}

export function recoverMembers(committee?: CommitteeData): Dictionary<MemberID, MemberData> | undefined {
  return committee ? (committee.members || {} as Dictionary<MemberID, MemberData>) : undefined;
}

export function recoverSettings(committee?: CommitteeData): SettingsData {
  let timersInSeparateColumns: boolean = DEFAULT_SETTINGS.timersInSeparateColumns;
  let moveQueueUp: boolean = DEFAULT_SETTINGS.moveQueueUp;
  let autoNextSpeaker: boolean = DEFAULT_SETTINGS.autoNextSpeaker;

  if (committee) {
    if (committee.settings.timersInSeparateColumns !== undefined) {
      timersInSeparateColumns = committee.settings.timersInSeparateColumns;
    }

    if (committee.settings.moveQueueUp !== undefined) {
      moveQueueUp = committee.settings.moveQueueUp;
    }

    if (committee.settings.autoNextSpeaker !== undefined) {
      autoNextSpeaker = committee.settings.autoNextSpeaker;
    }
  }

  return {
    timersInSeparateColumns, moveQueueUp, autoNextSpeaker
  };
}

export function recoverCaucus(committee: CommitteeData | undefined, caucusID: CaucusID): CaucusData | undefined {
  const caucuses = committee ? committee.caucuses : {};
  
  return (caucuses || {})[caucusID];
}

export function recoverResolution(committee: CommitteeData | undefined, resolutionID: ResolutionID): ResolutionData | undefined {
  const resolutions = committee ? committee.resolutions : {};
  
  return (resolutions || {})[resolutionID];
}

interface DesktopContainerProps {
  menu?: React.ReactNode;
  body?: React.ReactNode;
}

interface DesktopContainerState {
}

interface MobileContainerProps {
  menu?: React.ReactNode;
  body?: React.ReactNode;
}

interface MobileContainerState {
  sidebarOpened: boolean;
}

interface Props extends RouteComponentProps<URLParameters> {
}

interface State {
  committee?: CommitteeData;
  committeeFref: firebase.database.Reference;
}

export type CommitteeID = string;

export interface CommitteeData {
  name: string;
  chair: string;
  topic: string;
  conference?: string; // TODO: Migrate
  creatorUid: firebase.UserInfo['uid'];
  members?: Dictionary<MemberID, MemberData>;
  caucuses?: Dictionary<CaucusID, CaucusData>;
  resolutions?: Dictionary<ResolutionID, ResolutionData>;
  motions?: Dictionary<MotionID, MotionData>;
  files?: Dictionary<PostID, PostData>;
  timer: TimerData;
  notes: string;
  settings: SettingsData;
}

const GENERAL_SPEAKERS_LIST: CaucusData = {
   ...DEFAULT_CAUCUS, name: 'General Speakers List' 
};

export const DEFAULT_COMMITTEE: CommitteeData = {
  name: '',
  chair: '',
  topic: '',
  conference: '',
  creatorUid: '',
  members: {} as Dictionary<MemberID, MemberData>,
  caucuses: {
    'gsl': GENERAL_SPEAKERS_LIST
  } as Dictionary<string, CaucusData>,
  resolutions: {} as Dictionary<ResolutionID, ResolutionData>,
  files: {} as Dictionary<PostID, PostData>,
  timer: { ...DEFAULT_TIMER, remaining: DEFAULT_CAUCUS_TIME_SECONDS },
  notes: '',
  settings: DEFAULT_SETTINGS
};

class DesktopContainer extends React.Component<DesktopContainerProps, DesktopContainerState> {
  render() {
    const { body, menu } = this.props;

    // Semantic-UI-React/src/addons/Responsive/Responsive.js
    return (
      <Responsive {...{ minWidth: Responsive.onlyMobile.maxWidth as number + 1 }}>
        <Menu fluid size="small">
          {menu}
        </Menu>
        {body}
      </Responsive>
    );
  }
}

class MobileContainer extends React.Component<MobileContainerProps, MobileContainerState> {
  constructor(props: MobileContainerProps) {
    super(props);

    this.state = {
      sidebarOpened: false
    };
  }

  handlePusherClick = () => {
    const { sidebarOpened } = this.state;

    if (sidebarOpened) {
      this.setState({ sidebarOpened: false });
    }
  }

  handleToggle = () => {
    this.setState({ sidebarOpened: !this.state.sidebarOpened });
  }

  render() {
    const { body, menu } = this.props;
    const { sidebarOpened } = this.state;

    return (
      <Responsive {...Responsive.onlyMobile}>
        <Sidebar.Pushable>
          <Sidebar as={Menu} animation="uncover" stackable visible={sidebarOpened}>
            {menu}
          </Sidebar>

          <Sidebar.Pusher dimmed={sidebarOpened} onClick={this.handlePusherClick} style={{ minHeight: '100vh' }}>
            <Menu size="large">
              <Menu.Item onClick={this.handleToggle}>
                <Icon name="sidebar" />
              </Menu.Item>
            </Menu>
            {body}
          </Sidebar.Pusher>
        </Sidebar.Pushable>
      </Responsive>
    );
  }
}

interface ResponsiveContainerProps extends RouteComponentProps<URLParameters> {
  children?: React.ReactNode;
  committee?: CommitteeData;
}

class ResponsiveNav extends React.Component<ResponsiveContainerProps, {}> {
  makeMenuItem = (name: string, icon: SemanticICONS) => {
    const committeeID: CommitteeID = this.props.match.params.committeeID;
    const destination = `/committees/${committeeID}/${name.toLowerCase()}`;

    return (
      <Menu.Item
        key={name}
        name={name.toLowerCase()}
        active={this.props.location.pathname === destination}
        onClick={() => this.props.history.push(destination)}
      >
        {/* <Icon name={icon} /> */}
        {name}
      </Menu.Item>
    );
  }

  makeSubmenuButton = (name: string, icon: SemanticICONS, f: () => void) => {
    return (
      <Dropdown.Item
        key={name}
        name={name.toLowerCase()}
        active={false}
        onClick={f}
      >
        <Icon name={icon} />
        {name}
      </Dropdown.Item>
    );
  }

  makeMenuIcon = (name: string, icon: SemanticICONS) => {
    const committeeID: CommitteeID = this.props.match.params.committeeID;
    const destination = `/committees/${committeeID}/${name.toLowerCase()}`;

    return (
      <Menu.Item
        key={name}
        name={name.toLowerCase()}
        active={this.props.location.pathname === destination}
        position="right"
        onClick={() => this.props.history.push(destination)}
      >
        <Icon name={icon} />
      </Menu.Item>
    );
  }

  makeSubmenuItem = (id: string, name: string, type: 'caucuses' | 'resolutions') => {
    const { committeeID } = this.props.match.params;
    const destination = `/committees/${committeeID}/${type}/${id}`;

    return (
      <Dropdown.Item
        key={id}
        name={name}
        active={this.props.location.pathname === destination}
        onClick={() => this.props.history.push(destination)}
      >
        {name}
      </Dropdown.Item>
    );
  }

  pushCaucus = () => {
    const committeeID: CommitteeID = this.props.match.params.committeeID;
    const ref = postCaucus(committeeID, DEFAULT_CAUCUS);

    this.props.history
      .push(`/committees/${committeeID}/caucuses/${ref.key}`);
  }

  pushResolution = () => {
    const committeeID: CommitteeID = this.props.match.params.committeeID;
    const ref = postResolution(committeeID, DEFAULT_RESOLUTION);

    this.props.history
      .push(`/committees/${committeeID}/resolutions/${ref.key}`);
  }

  renderMenuItems = () => {
    const { makeMenuItem, makeSubmenuItem, makeMenuIcon, makeSubmenuButton } = this;
    const { committee } = this.props;

    const committeeID: CommitteeID = this.props.match.params.committeeID;
    const caucuses = committee ? committee.caucuses : undefined;
    const resolutions = committee ? committee.resolutions : undefined;

    const caucusItems = Object.keys(caucuses || {}).map(key =>
      makeSubmenuItem(key, caucuses![key].name, 'caucuses')
    );

    const resolutionItems = Object.keys(resolutions || {}).map(key =>
      makeSubmenuItem(key, resolutions![key].name, 'resolutions')
    );

    return (
      <React.Fragment>
        <Menu.Item
          header
          key="header"
          onClick={() => this.props.history.push(`/committees/${committeeID}`)}
          active={this.props.location.pathname === `/committees/${committeeID}`}
        >
          {committee ? committee.name : <Loading small />}
        </Menu.Item>
        {makeMenuItem('Admin', 'users')}
        {makeMenuItem('Motions', 'sort numeric descending')}
        {makeMenuItem('Unmod', 'discussions')}
        <Dropdown key="caucuses" item text="Caucuses" loading={!committee} icon={committee ? 'add' : undefined}>
          <Dropdown.Menu>
            {makeSubmenuButton('New caucus', 'add', this.pushCaucus)}
            {caucusItems}
          </Dropdown.Menu>
        </Dropdown>
        <Dropdown key="resolutions" item text="Resolutions" loading={!committee} icon={committee ? 'add' : undefined}>
          <Dropdown.Menu>
            {makeSubmenuButton('New resolution', 'add', this.pushResolution)}
            {resolutionItems}
          </Dropdown.Menu>
        </Dropdown>
        {makeMenuItem('Notes', 'sticky note outline')}
        {makeMenuItem('Files', 'file outline')}
        {makeMenuItem('Stats', 'chart bar')}
        <Menu.Menu key="icon-submenu" position="right">
          {makeMenuIcon('Settings', 'settings')}
          {makeMenuIcon('Help', 'help')}
        </Menu.Menu>
        <Menu.Item key="login">
          <ModalLogin />
        </Menu.Item>
      </React.Fragment>
    );
  }

  render() {
    return (
      <React.Fragment>
        <DesktopContainer body={this.props.children} menu={this.renderMenuItems()} />
        <MobileContainer body={this.props.children} menu={this.renderMenuItems()} />
      </React.Fragment>
    );
  }
}

export default class Committee extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const committeeID: CommitteeID = this.props.match.params.committeeID;

    this.state = {
      committeeFref: firebase.database().ref('committees').child(committeeID),
    };
  }

  firebaseCallback = (committee: firebase.database.DataSnapshot | null) => {
    if (committee) {
      this.setState({ committee: committee.val() });
    }
  }

  componentDidMount() {
    this.state.committeeFref.on('value', this.firebaseCallback);
  }

  componentWillUnmount() {
    this.state.committeeFref.off('value', this.firebaseCallback);
  }

  renderAdmin = () => {
    return (
      <Admin
        committee={this.state.committee || DEFAULT_COMMITTEE}
        fref={this.state.committeeFref}
      />
    );
  }

  renderWelcome = () => {
    const { committee, committeeFref } = this.state;

    return (
      <Container text style={{ padding: '1em 0em' }}>
        <Header as="h1">
          <Input
            value={committee ? committee.name : ''}
            onChange={fieldHandler<CommitteeData>(committeeFref, 'name')}
            fluid
            error={committee ? !committee.name : false}
            placeholder="Committee name"
          />
        </Header>
        <List>
          <List.Item>
            <Input
              label="Topic"
              value={committee ? committee.topic : ''}
              onChange={fieldHandler<CommitteeData>(committeeFref, 'topic')}
              fluid
              loading={!committee}
              placeholder="Committee topic"
            />
          </List.Item>
          <List.Item>
            <Input
              label="Chairpeople"
              value={committee ? committee.chair : ''}
              onChange={fieldHandler<CommitteeData>(committeeFref, 'chair')}
              fluid
              loading={!committee}
              placeholder="Name(s) of chairperson or chairpeople"
            />
          </List.Item>
          <List.Item>
            <Input
              label="Conference"
              value={committee ? (committee.conference || '') : ''}
              onChange={fieldHandler<CommitteeData>(committeeFref, 'conference')}
              fluid
              loading={!committee}
              placeholder="Conference name"
            />
          </List.Item>
        </List>
        <Divider />
        <ShareHint committeeID={this.props.match.params.committeeID} />
        <Divider />
        <Header as="h3">Keyboard Shortcuts</Header>
        {KEYBOARD_SHORTCUT_LIST}
      </Container>
    );
  }

  render() {
    const { renderAdmin, renderWelcome } = this;

    return (
      <React.Fragment>
        <Notifications {...this.props} />
        <ResponsiveNav {...this.props} committee={this.state.committee} >
          <Container text>
            <ConnectionStatus />
          </Container>
          <Route exact={true} path="/committees/:committeeID" render={renderWelcome} />
          <Route exact={true} path="/committees/:committeeID/admin" render={renderAdmin} />
          <Route exact={true} path="/committees/:committeeID/stats" component={Stats} />
          <Route exact={true} path="/committees/:committeeID/unmod" component={Unmod} />
          <Route exact={true} path="/committees/:committeeID/motions" component={Motions} />
          <Route exact={true} path="/committees/:committeeID/notes" component={Notes} />
          <Route exact={true} path="/committees/:committeeID/files" component={Files} />
          <Route exact={true} path="/committees/:committeeID/settings" component={Settings} />
          <Route exact={true} path="/committees/:committeeID/help" component={Help} />
          <Route path="/committees/:committeeID/caucuses/:caucusID" component={Caucus} />
          <Route path="/committees/:committeeID/resolutions/:resolutionID" component={Resolution} />
          <Footer />
        </ResponsiveNav>
      </React.Fragment>
    );
  }
}
