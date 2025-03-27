/** This component is for displaying each item in the record, passed to it from UserList */
import React from 'react';
import UserSearchResult from './interfaces/search-result.interface';

type Props = {
    searchResult: UserSearchResult,
    handleViewSearchResult: Function
}

const SearchResult: React.FC<Props> = ({searchResult, handleViewSearchResult}) => {

    const onViewSearchResult = () => {
        //Go and get the user by id
        handleViewSearchResult(searchResult)
    }

    return (
        <tr onClick={onViewSearchResult} className="column is-full">
            <td>
                The information here is about user number {searchResult.id}. 
                You may or may not present this in a tabular form. 
                First name of user is {searchResult.firstName},
                surname is {searchResult.lastName} and
                the user is a {searchResult.landlord? 'landlord': 'tenant'}. 
                Click on any row to retrieve user details.</td>
            <td>{searchResult.firstName}</td>
            <td>{searchResult.lastName}</td>
            <td>{searchResult.landlord? 'Landlord' : 'Tenant'}</td>
        </tr>
    );
}

export default SearchResult;
