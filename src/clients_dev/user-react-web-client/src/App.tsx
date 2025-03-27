import React from 'react';
//Below requires npm install @loadable/component @types/loadable__component. See https://reactrouter.com/web/guides/code-splitting
import loadable from "@loadable/component";

import {
  Route,
  Switch,
  NavLink
} from 'react-router-dom';

//import SearchUsers from './user-app/components/search/SearchUsers' //this option does not use react-router subroutes
//import SearchUsersWithRouterNavigation from './user-app/components/search/SearchUsersWithRouterNavigation';
import ViewSelectedUserWithRouterNavigation from './user-app/components/search/ViewSelectedUserWithRouterNavigation';
//import SearchUsers from './user-app/components/search/SearchUsers';
//import RoleApp from './components/role/Role'; //replaced with loadable component below
//import UserApp from './user-app/UserApp'; //replaced with loadable component below

/* Below, we use reloadable to dynamically load RoleApp and UserApp components, when the route to them is clicked. 
Reloadable ensures that the javascript build is split for optimal load speed. a.k.a code splitting 
First created a component that shows loading message */
/**
 * Below is a component that simply shows loading button without text or borders
 */
const Loading: React.FC = () => {
  return (
    <div>
      <button className="button is-text is-loading">   </button>
    </div>
  )
}

//I am making SearchUsersWithRouterNavigation reloadable because renderToNodeStream on server side will fail with the use of localStorage
const SearchUsersWithRouterNavigation = loadable(() => import("./user-app/components/search/SearchUsersWithRouterNavigation2"), {
  fallback: <Loading />
});

const RoleApp = loadable(() => import("./role-app/RoleApp"), {
  fallback: <Loading />
});

const UserApp = loadable(() => import('./user-app/UserApp'), {
  fallback: <Loading />
})


type Props = {
  baseUrl: string
}

const App: React.FC<Props> = ({ baseUrl }) => {
  
  return (
    <div>
      <div className="navbar is-transparent" role="navigation" aria-label="main navigation">
        {/*navbar-brand is for the logo and hamburger menu for narrow screens*/}
        <div className="container ">
          {/*This makes the navigator left and right align with other containers in the page*/}
          <div className="navbar-brand">
            {/*Notice the data-target below in the hamburger menu. Set is-active when on mobile*/}
            {// eslint-disable-next-line
              <a role="button" className="navbar-burger burger" aria-label="menu" aria-expanded="false"
                data-target="userClientAppMenu">
                <span aria-hidden="true"></span>
                <span aria-hidden="true"></span>
                <span aria-hidden="true"></span>
              </a>}
          </div>
          {/*Notice the id="bookExampleMenu" here. This makes this div's menuitems the data-target for the navbar-burger above*/}
          <div id="userClientAppMenu" className="navbar-menu">
            {/*navbar-start below is for a set of menu items that are left oriented */}
            <div className="navbar-start">
              <NavLink activeClassName='is-active' to={`${baseUrl}/`} >
                {// eslint-disable-next-line
                  <a className="navbar-item">
                    Search Users</a>
                }
              </NavLink>
              <NavLink activeClassName='is-active' to={`${baseUrl}/user-admin`} >
                {// eslint-disable-next-line
                  <a className="navbar-item">
                    User Admin</a>
                }
              </NavLink>
              <NavLink activeClassName='is-active' to={`${baseUrl}/role-admin`} >
                {// eslint-disable-next-line
                  <a className="navbar-item">
                    Role Admin</a>
                }
              </NavLink>
            </div>
          </div>
        </div>
      </div>
      <Switch>
        {/** Below is for routing to search client demo */}
        <Route exact path={`${baseUrl}`} component={SearchUsersWithRouterNavigation} />
        {/** Below is for routing to view selected user to be called with history.push in SearchUsersWithRouterNavigation*/}
        <Route exact path={`${baseUrl}/view-selected`} component={ViewSelectedUserWithRouterNavigation} />

        <Route exact path={`${baseUrl}/user-admin`} component={UserApp} />
        {/** Below is for routing to role admin */}
        <Route exact path={`${baseUrl}/role-admin`} component={RoleApp} />

        {/** Below is for routing URL that matches the path patter /hello/:variable */}
        <Route path={`${baseUrl}/hello/:name`} render={({ match }) => {
          return (
            <h3>Hello {match.params.name}</h3>
          );
        }}
        />
        {/**Route below is not associated with any path. This means that this route will be invoked
             * whenever any URL path entered is not found
             */}
        <Route render={() => {
          return (
            <h3>Page not found</h3>
          );
        }}
        />
      </Switch>
    </div>

  );
}

export default App;
