import React, { useEffect, useReducer } from 'react';
import { IAction, IFindOptions, IState } from './global/app.interfaces';
import reducer from './reducers/app.reducer';

import { handleCreateTenant } from './tenant-crud-handlers/create';
import { handleDeleteTenant } from './tenant-crud-handlers/delete';
import { handleUpdateTenant } from './tenant-crud-handlers/update';
import { handleReadTenants } from './tenant-crud-handlers/read';
import Alert from './components/Alert';
import TenantList from './components/TenantList';
import AddTenant from './components/AddTenant';
import EditTenant from './components/EditTenant';
import ViewTenant from './components/ViewTenant';
import { AppContext } from './contexts/app.contexts';

/**
 * Here, we take for granted that on initialization, 
 * jwt token string may be sent by the server, if there is valid login
 * To get the userinfo and roles from the token, 
 * we can use https://github.com/auth0/jwt-decode
 */
/*
type Props = {
  jwtToken?: string
}
*/


/*Let us define type for our reducer so that we can easily pass any type of previous state and action.
Reducer is simply a type of function that takes previous state and action and returns a new state as represented
We don't have to do this. But it is good to know.*/
type Reducer<S, A> = (prevState: S, action: A) => S;

const App: React.FC<IState> = (props) => {//assuming that props passed will be initial state values

  /*let us organize state, using useReducer*/
  //Prepare initial state values
  const initialState: IState =
  {
    tenants: props.tenants || [],
    tenantsCount: props.tenantsCount || 0,
    tenant: props.tenant || null ,
    onAddTenant: props.onAddTenant || false,
    onViewTenant: props.onViewTenant || false,
    onEditTenant: props.onEditTenant || false,
    alert: props.alert || { show: false, message: '', type: '' }
  };

  //using useReducer instead of useState
  const [state, dispatch] = useReducer<Reducer<IState, IAction>>(reducer, initialState);

  /*Additional handler functions here*/
  //Below is called by Alert component.
  const handleCloseAlert = () => {
    dispatch({ type: 'HandleCloseAlert' });
  }


  //Just testing findOptions. Can be used to qualify find.
  //let findOptions: IFindOptions = {"select":["id","uniqueName"], "order": {"uniqueName": "ASC", "id": "DESC"}}
  //let findOptions: IFindOptions = {}
  let findOptions: IFindOptions = {"relations":["primaryContact","teamMembers", "tenantAccountOfficers", "customTheme", "tenantConfigDetail"]};
  /**
   * useEffect to be run once, hence the second parameter []. Loads data at componentDidMount life cycle stage
   */
  useEffect(() => {
    handleReadTenants(dispatch, findOptions);
    // eslint-disable-next-line
  }, []);

  /*Time to logically decide what to show.*/
  //Setup alert component as a variable so we don't keep repeating
  const myAlert = (
    <Alert type={state.alert.type} message={state.alert.message} onClickHandler={handleCloseAlert} />
  )

  //check if editTenant should be loaded or not since it is conditional loading
  if (state.onEditTenant && state.tenant !== null) {
    return (
      <div className="container ">
        <div className="content is-medium">
          <p>
            <EditTenant tenant={state.tenant!} handleUpdateTenant={handleUpdateTenant} dispatch={dispatch} />
          </p>
          <p>
            {state.alert.show && myAlert}
          </p>
          <p>
            <AppContext.Provider value={{ dispatch, handleDeleteTenant }}>
              <TenantList tenants={state.tenants!} />
            </AppContext.Provider>
          </p>
        </div>
      </div>
    );
  } else if (state.onAddTenant) {//Display AddTenant along with TenantList if onAddTenant is true
    return (
      <div className="container ">
        <div className="content is-medium">
          <p>
            <AddTenant handleCreateTenant={handleCreateTenant} dispatch={dispatch} />
          </p>
          <p>
            {state.alert.show && myAlert}
          </p>
          <p>
            <AppContext.Provider value={{ dispatch, handleDeleteTenant }}>
              <TenantList tenants={state.tenants!} />
            </AppContext.Provider>
          </p>
        </div>
      </div>
    );
  } else if (state.onViewTenant && state.tenant != null) {
    return (
      <div className="container">
        <div className="content is-medium">
          <p>
            <AppContext.Provider value={{dispatch, handleDeleteTenant }}>
              <ViewTenant tenant={state.tenant!} />
            </AppContext.Provider>
          </p>
        </div>
      </div>
    );
  } else {//onAddTenant, onEditTenant and onViewTenant are all false
    return (
      <div className="container ">
        <div className="content is-medium">
          <p>
            <button className="button is-outline" onClick={() => { dispatch({ type: 'HandleOnAddTenant' }) }}>+ Add Tenant</button>
          </p>
          <p>
            {state.alert.show && myAlert}
          </p>
          <p>
            <AppContext.Provider value={{ dispatch, handleDeleteTenant }}>
              <TenantList tenants={state.tenants!} />
            </AppContext.Provider>
          </p>
        </div>
      </div>
    );
  }

}

export default App;
