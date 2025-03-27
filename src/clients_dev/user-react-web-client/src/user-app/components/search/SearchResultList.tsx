import React from 'react';
import UserSearchResult from './interfaces/search-result.interface';
import SearchResult from './SearchResult';


//declare type for Props passed to this 
type Props = {
    searchResults: UserSearchResult[],
    handleViewSearchResult: Function
}

const SearchResultList: React.FC<Props> = ({searchResults, handleViewSearchResult}) => {

    //prepare users for display in a table
    let searchResultListRows = null;
    
    searchResultListRows = searchResults.map((searchResult) => {
        return <SearchResult searchResult={searchResult} key={searchResult.id} handleViewSearchResult={handleViewSearchResult} />
    })

    return (
        <table className="table is-hoverable content">
            <h3>Users found:</h3>
            <tbody>
                {searchResultListRows.length>0? searchResultListRows: 'None'}
            </tbody>
        </table>
    );
}

export default SearchResultList;
