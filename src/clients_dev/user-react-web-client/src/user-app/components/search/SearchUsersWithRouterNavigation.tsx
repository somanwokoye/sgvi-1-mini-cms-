/**
 * Here, the goal is to setup routes for ViewSearchResults, instead of using a modal window.
 * Not yet in order. Not yet in use
 */
import React, { useState } from 'react';
import Autosuggest from 'react-autosuggest'
import { IUser } from '../../app.interfaces';
import { SearchHandlers } from '../../crud-handlers/search-handlers';
import SearchResultList from './SearchResultList';

import {
    useHistory, //see https://ultimatecourses.com/blog/programmatically-navigate-react-router
    useRouteMatch //see https://reactrouter.com/web/example/nesting
} from 'react-router-dom';

type SuggestionType = { //same as setup in server
    score: number,
    id: number,
    firstName: string,
    lastName: string,
    homeAddress: string,
    landlord: boolean
}

type StateType = {
    value: string,
    suggestions: SuggestionType[],
    showUser?: boolean,
    user?: IUser | null, //selected user to show
    searchResults?: [] | null
    showSearchResults?: boolean
}

const SearchUsersWithRouterNavigation: React.FC = () => {

    const initialState = {
        suggestions: [],
        value: '',
        showUser: false,
        user: null, //selected user to shown
        searchResults: null,
        showSearchResults: false,
    }

    const [state, setState] = useState<StateType>(initialState);

    //const selectedSuggestionRef: React.MutableRefObject<any> = useRef('');


    /* Here we are setting up route for navigating to view result */
    // The `path` lets us build <Route> paths that are
    // relative to the parent route, while the `url` lets
    // us build relative links.
    // See https://reactrouter.com/web/example/nesting
    let { path, url } = useRouteMatch();

    const history = useHistory(); //To dynamically go to a route. See https://ultimatecourses.com/blog/programmatically-navigate-react-router


    const onSuggestionsFetchRequested = async ({ value }: any) => {

        try {
            const result = await SearchHandlers.fetchSuggestions(value);
            //update selection ref to be in harmony with value to be put in state, in case it is needed
            //selectedSuggestionRef.current = value;
            setState({ ...state, suggestions: result, value }); //save value back in state?

        } catch (error) {
            setState({ ...state, suggestions: [], value: '' }); //clear
            console.log(error)
        }
    }

    const renderSuggestion = (suggestion: SuggestionType) => {
        //This is responsibile for showing what will appear in suggestion drop down. Could be product type, name, etc. Whatever combinations will be intuitive to the user
        return (
            <div>
                {`${suggestion.firstName} ${suggestion.lastName}`}
            </div>
        )
    }

    const onSuggestionsClearRequested = () => {
        //Clear values in state when user clears input box. Also called by <Autosuggest /> under some conditions
        setState({ ...state, suggestions: [], value: '' })
    }

    /**
     * This is called whenever input field value changes
     * @param event 
     * @param param1 
     */
    const onChange = (event: any, { newValue, method }: any) => {
        //The optional method argument here could be useful if one has to distinguish between 'click' and 'enter' and act accordingly
        setState({ ...state, value: newValue })
    }

    /**
     * Optional prop but useful for getting immediately, the details of a specific suggestion that the user
     * chooses to click on.
     * @param event 
     * @param param1 
     */
    const onSuggestionSelected = async (event: any, { suggestion, suggestionValue, suggestionIndex, sectionIndex, method }: any) => {
        //use ref to hold current selection, just in case it is needed. Not really using it.
        //selectedSuggestionRef.current = suggestionValue;
        //As I have set the suggestionValue to the userId as passed to <Autosuggest /> I will directly fetch the suggestion selected
        try {
            const user: IUser = await SearchHandlers.getUser(suggestionValue);

            //put user in localStorage for pickup by ViewSelectedUserWithRouterNavigation
            //localStorage.setItem("userForViewPlusReturnUrl", JSON.stringify({ ...user, returnUrl: path }));//Note that I add returnUrl to the string
            setState({ ...state, showUser: true, user })
        } catch (error) {
            console.log(error)
        }
    }

    /**
     * This is called when the user hits enter key with search input form in focus.
     * My idea here is to do a match search call for the current value in state at the time enter was clicked
     * This should return a number of search results that correspond to the search string. 
     * The search result can then be used to establish links to details of each result.
     * @param event 
     */
    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();//do not do the default form submit to the server
        //TODO: call users/search to search the current value in state
        try {
            const searchResults = await SearchHandlers.searchUsers(state.value);
            setState({ ...state, searchResults, showSearchResults: true, value: '' })
        } catch (error) {
            console.log(error)
        }
    }

    /**
     * These props are for use by <Autosuggest />
     */
    const inputProps = {
        placeholder: 'Start typing user full name for search',
        value: state.value,
        name: "autosuggest",
        onChange: onChange
    }

    /* No need for this. history.goBack should do it.
    const handleCloseUser = () => {
        setState({ ...state, showUser: false, user: null })
    }
    */

    const handleViewSearchResult = (user: IUser) => {//to be passed on to the SearchResult component via SearchResultList. I should have used context though.
        //put user in localStorage for pickup by ViewSelectedUserWithRouterNavigation
        //localStorage.setItem("userForViewPlusReturnUrl", JSON.stringify({ ...user, returnUrl: path}));//Note that I add returnUrl to the string
        setState({ ...state, showUser: true, user });
    }

    return (
        <div>
            <div className="container">
                <div className="box">
                    <div className="columns is-mobile">
                        <form onSubmit={onSubmit} className="column is-one-third">
                            <div className="field">
                                <label className="label">Search:</label>
                                <Autosuggest
                                    suggestions={state.suggestions}
                                    onSuggestionsFetchRequested={onSuggestionsFetchRequested}
                                    onSuggestionsClearRequested={onSuggestionsClearRequested}
                                    getSuggestionValue={(suggestion: SuggestionType) => `${suggestion.id}`}
                                    renderSuggestion={renderSuggestion}
                                    inputProps={inputProps}
                                    onSuggestionSelected={onSuggestionSelected} //optional
                                    highlightFirstSuggestion={false} //optional. Defaults to false
                                />
                                {/* Below is just in case you need to display the current search string typed in
                            <label className="label">String to search:</label>
                            <input className="label" style=
                                {{
                                    backgroundColor: 'transparent',
                                    borderColor: 'transparent',
                                    outline: 'transparent'
                                }}
                                name="selected-suggestion" value={selectedSuggestionRef.current} readOnly 
                            />
                            */}
                            </div>

                        </form>
                    </div>
                    <div className="columns is-mobile">
                        <div className="column is-full">
                            {
                                //localStorage.getItem("userForView") && state.showUser && history.push(`${path}/view-selected`, localStorage.getItem("userForView"))
                                state.user && state.showUser && history.push(`${path}/view-selected`, JSON.stringify({...state.user, returnUrl: path}))
                            }
                            {
                                state.searchResults && state.showSearchResults && <SearchResultList searchResults={state.searchResults} handleViewSearchResult={handleViewSearchResult} />
                            }
                        </div>

                    </div>
                    {/*
            <div>
                <input list="browsers" name="browser" />
                <datalist id="browsers">
                    <option value="Internet Explorer" />
                    <option value="Firefox" />
                    <option value="Chrome" />
                    <option value="Opera" />
                    <option value="Safari" />
                </datalist>
            </div>
            */}
                </div>
            </div>

        </div>
    )
}

export default SearchUsersWithRouterNavigation;