/** This component is for displaying each tenant in the record, passed to it from TenantList */
import React, { useEffect, useState } from 'react';
import { Gender, IAction, IAssignableRegionInfo, ITenant, TenantStatus } from '../global/app.interfaces';
import { RelationsHandlers } from '../tenant-crud-handlers/relations-handlers';

//create the type for the anticipated props to be passed from parent component
type Props = {
    handleCreateTenant: Function,
    dispatch: React.Dispatch<IAction>
}

export type IAddTenantState = {
    tenant: ITenant,
    createPrimaryContact: boolean,
    assignableRegionsInfo: IAssignableRegionInfo[],
    regionChosen: IAssignableRegionInfo | null,
    chosenDomainNameExists: boolean,
    domainNameExistsChecked: boolean
}

const AddTenant: React.FC<Props> = (props) => {

    const initialTenantState: ITenant = {
        name: '',
        subDomainName: null,
        regionName: '',
        regionRootDomainName: '',
        address: '',
        moreInfo: '',
        status: undefined,
        customURLSlug: null,
        dateOfRegistration: new Date(),
        active: true,
        uniqueSchema: true,
        primaryContact: {isPrimaryEmailAddressVerified: false}

        /* As we did for primaryContact, we can also do for the other relations
        tenantConfigDetail: {},
        customTheme: {},
        teamMembers: [],
        tenantAccountOfficers: []
        */
    }

    const initialState: IAddTenantState = {
        tenant: initialTenantState,
        createPrimaryContact: true,
        assignableRegionsInfo: [],
        regionChosen: null,
        chosenDomainNameExists: true,
        domainNameExistsChecked: false
    }

    //declare the state variable for tenant to be added from form. Notice that we are using an object containing the individual elements
    //We need to interact with them individually as state variable that will change in response to input onChange 
    const [state, setState] = useState<IAddTenantState>({ ...initialState });


    //create a general onChange event handler for form inputs that fire onChange event
    //See https://reactjs.org/docs/events.html? for all kinds of events that can be handled in react
    const onChange = (event: React.FormEvent) => {
        const tenant = state.tenant;//check out tenant in state as is
        //modify element in the state which has the same name as the input that fired this event. Pass the new value
        const target: HTMLInputElement | HTMLSelectElement = event.target as HTMLInputElement | HTMLSelectElement; //as is used here to cast
        tenant[target.name] = target.value;
        if (target.name == 'subDomainName') {
            setState({ ...state, tenant, domainNameExistsChecked: false });//checkin the modified tenant state and indicate that domainName needs to be checked again
        } else {
            setState({ ...state, tenant });//checkin the modified tenant state
        }

    }

    const onRegionChange = (event: React.FormEvent) => {

        const target: HTMLInputElement | HTMLSelectElement = event.target as HTMLInputElement | HTMLSelectElement; //as is used here to cast
        const regionName = target.value;
        const regionChosen: IAssignableRegionInfo = state.assignableRegionsInfo.find(region => region.name === regionName)!;

        //setState
        //first update tenant
        const tenant = { ...state.tenant, regionName: regionChosen.name, regionRootDomainName: regionChosen.rootDomainName };
        setState({ ...state, tenant, regionChosen, domainNameExistsChecked: false });
        //Todo: test to see if subDomainName.rootDomainName is available
        if (state.tenant.subDomainName != null && state.tenant.subDomainName != '') {
            //make a call to server to check for unique combination of regionName and subDomainName in tenant
        }

    }
    const checkIfChosenDomainNameExists = (event: React.FormEvent) => {
        event.preventDefault();
        if (state.tenant.subDomainName != null && state.tenant.subDomainName != '' && state.tenant.regionRootDomainName != null)
            RelationsHandlers.checkIfChosenDomainNameExists(
                state.tenant.subDomainName!, state.tenant.regionRootDomainName!, state, setState);
    }

    const onPrimaryContactChange = (event: React.FormEvent) => {
        const tenant = state.tenant;//check out tenant in state as is
        //modify element in the state which has the same name as the input that fired this event. Pass the new value
        const target: HTMLInputElement | HTMLSelectElement = event.target as HTMLInputElement | HTMLSelectElement; //as is used here to cast
        //tenantState[target.name] = target.value;
        tenant['primaryContact']![target.name] = target.value;
        setState({ ...state, tenant });//checkin the modified state
    }

    const isPrimaryEmailAddressVerifiedChange = () => {
        //toggle
        const isPrimaryEmailAddressVerified = state.tenant.primaryContact!.isPrimaryEmailAddressVerified? false: true;
        //override value in state
        const primaryContact = {...state.tenant.primaryContact, isPrimaryEmailAddressVerified};
        const tenant = {...state.tenant, primaryContact};
        setState ({...state, tenant});
    }

    //function to handle form onSubmit event
    const onSubmit = (event: React.FormEvent) => {
        event.preventDefault();//do not do the default form submit to the server
        const tenant = state.tenant;

        //Below condition is just to test the process requiring no further email verification
        //which will allow tenantConfigDetail to be created.
        /*if (tenant.primaryContact)
            tenant.primaryContact.isPrimaryEmailAddressVerified = true;
            */

        props.handleCreateTenant(state.tenant, state.createPrimaryContact ? 1 : 0, props.dispatch);//call the handleAddTenant function passed via props.
    }

    //function to handle form onCancel
    const onCancel = () => {
        //dispatch to state
        props.dispatch({ type: 'HandleCancelCreate' })
    }

    const handlePrimaryContactChoice = () => {
        //toggle choice in state
        const createPrimaryContact = state.createPrimaryContact ? false : true
        setState({ ...state, createPrimaryContact })
    }

    useEffect(() => {
        RelationsHandlers.getAssignableRegions(state, setState);
        // eslint-disable-next-line
    }, []);

    //Note where the above functions are used below within the return statement
    return (
        <form onSubmit={onSubmit}>
            <div className="box">
                <div className="columns is-mobile">
                    <h3>Add Tenant</h3>
                </div>
                <div className="columns is-mobile">
                    <div className="column">

                        <div className="box">
                            <div className="field">
                                <label className="label">Name</label>
                                <div className="control">
                                    <input className="input" type="text" placeholder="Your preferred common name" name="name" value={state.tenant.name} onChange={onChange} required />
                                </div>
                            </div>
                            {state.assignableRegionsInfo!.length > 0 &&

                                <div className="box">

                                    <h6>Choose region and domain name</h6>
                                    <div className="field">
                                        <label className="label">Region</label>
                                        <select name="region" id="region" multiple className="control" onChange={onRegionChange} style={{ minWidth: '50%' }}>
                                            {state.assignableRegionsInfo.map((assignableRegion) => {
                                                return <option value={assignableRegion.name}>{`Name: ${assignableRegion.name}; 
                                                        Location: ${assignableRegion.city}, 
                                                        ${assignableRegion.country}; Applicable domain name: ${assignableRegion.rootDomainName}`}</option>

                                            })}
                                        </select>
                                    </div>
                                    <div className="field">
                                        <label className="label">Subdomain name</label>
                                        <div className="control">
                                            {
                                                state.domainNameExistsChecked && state.tenant.subDomainName && state.regionChosen
                                                    ?
                                                    <div>
                                                        <input className={`input ${state.chosenDomainNameExists ? 'is-danger' : 'is-success'}`} type="text" placeholder="Enter your preferred subdomain name. Must be available for the Region chosen" name="subDomainName" value={state.tenant.subDomainName!} onChange={onChange} required />
                                                        <p className={`help ${state.chosenDomainNameExists ? 'is-danger' : 'is-success'}`}>Your chosen domain name {state.tenant.subDomainName && state.regionChosen ? `${state.tenant.subDomainName}.${state.regionChosen.rootDomainName}` : ''} {state.chosenDomainNameExists ? 'is unavailable' : 'is available'}</p>
                                                    </div>
                                                    :
                                                    <input className="input" type="text" placeholder="Enter your preferred subdomain name. Must be available for the Region chosen" name="subDomainName" value={state.tenant.subDomainName!} onChange={onChange} required />
                                            }
                                        </div>
                                    </div>

                                    <div className="field">
                                        <button className="button" disabled={state.tenant.subDomainName && state.regionChosen ? false : true} onClick={checkIfChosenDomainNameExists}>Check Availability</button>
                                    </div>
                                </div>}

                            <div className="field">
                                <label className="label">Address</label>
                                <div className="control">
                                    <input className="input" type="text" placeholder="Address input" name="address" value={state.tenant.address} onChange={onChange} required />
                                </div>
                            </div>
                            <div className="field">
                                <label className="label">More Information</label>
                                <div className="control">
                                    <textarea className="input" placeholder="More information input" rows={10} name="moreInfo" value={state.tenant.moreInfo} onChange={onChange} />
                                </div>
                            </div>
                            <div className="select">
                                <select name="status" onChange={onChange} value={state.tenant.status} required>
                                    <option value="notSelected">Select tenant status</option>
                                    <option value={TenantStatus.A}>Active</option>
                                    <option value={TenantStatus.O}>Owing</option>
                                    <option value={TenantStatus.S}>Suspended</option>
                                </select>
                            </div>
                            <div className="field">
                                <label className="label">Date of Registration</label>
                                <div className="control">
                                    <input className="input" type="date" required pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" max="{{todaysDate}}" placeholder="Date of registration" name="dateOfRegistration" value={state.tenant.dateOfRegistration?.toLocaleString()} onChange={onChange} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="column">
                        <div className="box">
                            <h4> Set Primary Contact</h4>
                            <div className="field">
                                <div className="control">
                                    <span><input type="checkbox" name="addPrimaryContact" value="" checked={state.createPrimaryContact} onChange={handlePrimaryContactChoice} />&nbsp;Create?</span>
                                </div>
                            </div>
                        </div>

                        {
                            !state.createPrimaryContact &&
                            <div className="box">
                                <div className="field">
                                    <label className="label">Primary Email Address of Contact</label>
                                    <div className="control">
                                        <input name="primaryEmailAddress" className="input" type="email" placeholder="Enter valid email here" maxLength={30} value={state.tenant.primaryContact!.primaryEmailAddress} onChange={onPrimaryContactChange} required />
                                    </div>
                                </div>
                            </div>
                        }

                        {state.createPrimaryContact &&
                            <div id="addPrimaryContactBox" className="box">
                                <h5>Create Primary Contact</h5>
                                <div className="field">
                                    <label className="label">Primary Email Address</label>
                                    <div className="control">
                                        <input name="primaryEmailAddress" className="input" type="email" placeholder="Enter valid email here" maxLength={30} value={state.tenant.primaryContact!.primaryEmailAddress} onChange={onPrimaryContactChange} required />
                                    </div>
                                    <p className="help">The email address should not be more than 30 letters</p>
                                </div>
                                <div className="field">
                                    <div className="control">
                                        <span><input type="checkbox" name="isPrimaryEmailAddressVerified" value="" checked={state.tenant.primaryContact!.isPrimaryEmailAddressVerified} onChange={isPrimaryEmailAddressVerifiedChange} />&nbsp;Primary Email Address Verified?</span>
                                    </div>
                                </div>
                                <div className="field">
                                    <label className="label">Password</label>
                                    <div className="control">
                                        <input name="passwordHash" className="input" type="password" placeholder="Enter password here" maxLength={128} value={state.tenant.primaryContact!.passwordHash} onChange={onPrimaryContactChange} required />
                                    </div>
                                    <p className="help">The password should not be more than 128 letters</p>
                                </div>
                                <div className="field">
                                    <label className="label">First Name</label>
                                    <div className="control">
                                        <input name="firstName" className="input" type="text" placeholder="Enter first name here" maxLength={30} value={state.tenant.primaryContact!.firstName} onChange={onPrimaryContactChange} required />
                                    </div>
                                    <p className="help">The first name should not be more than 30 letters</p>
                                </div>
                                <div className="field">
                                    <label className="label">Last Name</label>
                                    <div className="control">
                                        <input name="lastName" className="input" type="text" placeholder="Enter last name here" maxLength={30} value={state.tenant.primaryContact!.lastName} onChange={onPrimaryContactChange} required />
                                    </div>
                                    <p className="help">The last name should not be more than 30 letters</p>
                                </div>
                                <div className="field">
                                    <label className="label">Middle Name</label>
                                    <div className="control">
                                        <input name="middleName" className="input" type="text" placeholder="Enter middle name here" maxLength={30} value={state.tenant.primaryContact!.middleName} onChange={onPrimaryContactChange} />
                                    </div>
                                    <p className="help">Even though optional, it is advisable to enter middle name</p>
                                </div>
                                <div className="field">
                                    <label className="label">Common Name</label>
                                    <div className="control">
                                        <input name="commonName" className="input" type="text" placeholder="Enter common name here" maxLength={20} value={state.tenant.primaryContact!.commonName} onChange={onPrimaryContactChange} />
                                    </div>
                                    <p className="help">What is the user commonly called. The common name should not be more than 20 letters</p>
                                </div>
                                <div className="field">
                                    <label className="label">Home Address</label>
                                    <div className="control">
                                        <textarea name="homeAddress" className="input" rows={6} placeholder="Enter home address here" maxLength={100} value={state.tenant.primaryContact!.homeAddress} onChange={onPrimaryContactChange}></textarea>
                                    </div>
                                    <p className="help">The home address should not be more than 100 letters</p>
                                </div>
                                <div className="field">
                                    <label className="label">Gender</label>
                                    <div className="control">
                                        <div className="select">
                                            <select name="gender" value={state.tenant.primaryContact!.gender} onChange={onPrimaryContactChange}>
                                                <option value="notSelected">Select Gender</option>
                                                <option value={Gender.F}>Female</option>
                                                <option value={Gender.M}>Male</option>
                                            </select>
                                        </div>
                                    </div>
                                    <p className="help">Select the Gender</p>
                                </div>
                                <div className="field">
                                    <label className="label">Date of Birth</label>
                                    <div className="control">
                                        <input name="dateOfBirth" id="dateOfBirth" className="input" type="date"
                                            required pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" max={new Date().toLocaleString()} value={state.tenant.primaryContact!.dateOfBirth?.toLocaleString()} onChange={onPrimaryContactChange} />
                                    </div>
                                    <p className="help">The date of birth of the user. Pattern of entry is YYYY-MM-DD</p>
                                </div>
                                <div className="field">
                                    <label className="label">Nationality</label>
                                    <div className="control">
                                        <input name="nationality" className="input" type="text" placeholder="Enter nationality here" maxLength={30} value={state.tenant.primaryContact!.nationality} onChange={onPrimaryContactChange} />
                                    </div>
                                    <p className="help">The nationality should not be more than 30 letters</p>
                                </div>

                                <div className="field">
                                    <label className="label">State</label>
                                    <div className="control">
                                        <input name="stateOfOrigin" className="input" type="text" placeholder="Enter state here" maxLength={30} value={state.tenant.primaryContact!.stateOfOrigin} onChange={onPrimaryContactChange} />
                                    </div>
                                    <p className="help">The state should not be more than 30 letters</p>
                                </div>

                                <div className="field">
                                    <label className="label">Zip code</label>
                                    <div className="control">
                                        <input name="zip" className="input" type="text" placeholder="Enter zip code here" maxLength={6} value={state.tenant.primaryContact!.zip} onChange={onPrimaryContactChange} />
                                    </div>
                                    <p className="help">The zip code should not be more than 6 letters</p>
                                </div>

                            </div>}

                    </div>

                </div>
                <div className="columns is-mobile">
                    <div className="field is-grouped">
                        <div className="control">
                            <button className="button is-link">Submit</button>
                        </div>
                        <div className="control">
                            <button className="button is-link is-light" onClick={onCancel}>Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        </form>

    );
}

export default AddTenant;
