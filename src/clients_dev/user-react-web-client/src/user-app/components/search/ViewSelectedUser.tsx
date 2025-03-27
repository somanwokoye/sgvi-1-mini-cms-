/** This component is for displaying each item in the record, passed to it from UserList */
import React from 'react';
import { IRole, ITenant, ITenantTeam, IUser } from '../../app.interfaces';

type Props = {
    user: IUser,
    handleCloseUser: Function
}

type UserRolesDisplayProps = {
    role: IRole,
}

const UserRolesDisplay: React.FC<UserRolesDisplayProps> = ({ role }) => {
    return (
        <div className="columns">
            <div className="column">
                {role.name}
            </div>
        </div>
    )
}

type PrimaryContactForTenantDisplayProps = {
    tenant: ITenant,
}
const PrimaryContactForWhichTenantsDisplay: React.FC<PrimaryContactForTenantDisplayProps> = ({ tenant }) => {

    return (
        <div className="columns">
            <div className="column">
                {tenant.uniqueName}
            </div>
        </div>
    )
}

type TenantTeamMembershipsDisplayProps = {
    tenantTeam: ITenantTeam, //tenantteam contains roles and name of tenant
}

const TenantTeamMembershipsDisplay: React.FC<TenantTeamMembershipsDisplayProps> = ({ tenantTeam }) => {
    return (
        <div className="columns">
            <div className="column">
                {tenantTeam.tenantUniqueName}
            </div>
            <div className="column">
                <div>Roles:</div>
                {tenantTeam.roles!.map((role) => {//iterate through roles
                    return `${role} ` //display the role. TODO: make team membership role removable
                })}
            </div>
        </div>

    )
}

const ViewSelectedUser: React.FC<Props> = ({ user, handleCloseUser }) => {

    
    const onClickCloseButton = () => {
        handleCloseUser()
    }

    const onAddToCart = () => {
        alert('Just kidding! Cannot buy a user. Imagine if this was an eCommerce product')
    }

    return (
        <div className="modal modal-full-screen modal-fx-fadeInScale is-active" >
            <div className="modal-background"></div>
            <div className="modal-content">
                <header className="modal-card-head">
                    <p className="modal-card-title">{`Details of ${user.firstName}`}</p>
                    <button className="delete" aria-label="close" onClick={onClickCloseButton} />
                </header>
                <section className="modal-card-body">
                    {/*<!-- Content ... -->*/}
                    <div className="columns">
                        <div className="column is-two-thirds">
                            <div className="columns">
                                <div className="column is-two-fifths">
                                    First name:
                                </div>
                                <div className="column">
                                    {user.firstName}
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column is-two-fifths">
                                    Last name:
                                </div>
                                <div className="column">
                                    {user.lastName}
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column is-two-fifths">
                                    Middle name:
                                </div>
                                <div className="column">
                                    {user.middleName}
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column is-two-fifths">
                                    Common name:
                                </div>
                                <div className="column">
                                    {user.commonName}
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column is-two-fifths">
                                    Gender:
                                </div>
                                <div className="column">
                                    {user.gender}
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column is-two-fifths">
                                    Home address:
                                </div>
                                <div className="column">
                                    {user.homeAddress}
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column is-two-fifths">
                                    Phone numbers:
                                </div>
                                <div className="column">
                                    <div className="columns">
                                        <div className="column">
                                            Office:
                                        </div>
                                        <div className="column">
                                            {user.phone?user.phone!.office![0]: ''}
                                        </div>
                                        <div className="column">
                                            {user.phone?user.phone!.office![1]: ''}
                                        </div>
                                    </div>
                                    <div className="columns">
                                        <div className="column">
                                            Mobile:
                                        </div>
                                        <div className="column">
                                            {user.phone?user.phone!.mobile![0]:''}
                                        </div>
                                        <div className="column">
                                            {user.phone?user.phone!.mobile![1]:''}
                                        </div>
                                    </div>
                                    <div className="columns">
                                        <div className="column">
                                            Home:
                                        </div>
                                        <div className="column">
                                            {user.phone?user.phone!.home![0]:''}
                                        </div>
                                        <div className="column">
                                            {user.phone?user.phone!.home![1]:''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column is-two-fifths">
                                    Nationality:
                                </div>
                                <div className="column">
                                    {user.nationality}
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column is-two-fifths">
                                    State:
                                </div>
                                <div className="column">
                                    {user.state}
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column is-two-fifths">
                                    Zip:
                                </div>
                                <div className="column">
                                    {user.zip}
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column is-two-fifths">
                                    Landlord user?:
                                </div>
                                <div className="column">
                                    {user.landlord ? 'Yes' : 'No'}
                                </div>
                            </div>
                        </div>
                        <div className="column">
                            <div className="columns">
                                <div className="column">
                                    <div className="box">
                                        <h5>Photo</h5>
                                        <div className="columns">
                                            <div className="column">
                                                <img alt="user" src={`/v1/users/${user.id}/photo`} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="columns">
                                <div className="column">
                                    <div className="box">
                                        <h5>Assigned Roles</h5>
                                        <div className="columns">
                                            <div className="column">
                                                <div className="field">
                                                    {user.roles! && user.roles!.length > 0 ?
                                                        user.roles!.map((role) => { return <UserRolesDisplay role={role} /> }) :
                                                        <div>No roles assigned to user yet</div>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {!user.landlord &&
                                <div className="columns">
                                    <div className="column">
                                        <div className="box">
                                            <h5 className="label">Primary contact for</h5>
                                            <div className="columns">
                                                <div className="column">
                                                    <div className="field">
                                                        {user.primaryContactForWhichTenants! && user.primaryContactForWhichTenants!.length > 0 ?
                                                            user.primaryContactForWhichTenants!.map((tenant) => { return <PrimaryContactForWhichTenantsDisplay tenant={tenant} /> }) :
                                                            <div>Not a primary contact for any tenant</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            }
                            {!user.landlord &&
                                <div className="columns">
                                    <div className="column">
                                        <div className="box">
                                            <h5>Tenant Team Membership for</h5>
                                            <div className="columns">
                                                <div className="column">
                                                    <div className="field">
                                                        {user.tenantTeamMemberships! && user.tenantTeamMemberships!.length > 0 ?
                                                            user.tenantTeamMemberships!.map((tenantTeam) => { return <TenantTeamMembershipsDisplay tenantTeam={tenantTeam} /> }) :
                                                            <div>Not a team member of any tenant</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            }
                        </div>
                    </div>

                </section>
                <footer className="modal-card-foot">
                    <div className="buttons">
                        <button className="button is-success" onClick={onAddToCart}>Add to Cart</button>
                        <button className="button is-warning" onClick={onClickCloseButton}>Close</button>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default ViewSelectedUser;
